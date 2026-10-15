"""
Tienda y cobros tal como los usa este sitio: evz_store (catálogo, descargas,
planes) y evz_payments (PayPal, pagos manuales, suscripciones).
"""

import shutil
import tempfile
from decimal import Decimal
from io import BytesIO
from unittest import mock

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from evz_payments import paypal
from evz_payments.models import ManualPayment, PaymentMethod, WebhookEvent
from evz_store import services as store
from evz_store.models import Category, Download, Order, Plan, Product, Subscription, SubscriptionPayment
from evz_treasury.models import Transaction
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from accounts.models import User

MEDIA = tempfile.mkdtemp()


def make_pdf(pages=2):
    buf = BytesIO()
    c = canvas.Canvas(buf)
    for i in range(pages):
        c.drawString(100, 750, f'Página {i + 1}')
        c.showPage()
    c.save()
    return buf.getvalue()


def captured(order, amount=None, currency=None, status='COMPLETED'):
    """Respuesta de PayPal a una captura, con el importe del pedido por defecto."""
    return {
        'id': order.payment_reference, 'status': 'COMPLETED',
        'payer': {'email_address': 'comprador@example.org', 'name': {'given_name': 'Ana', 'surname': 'Ruiz'}},
        'purchase_units': [{
            'reference_id': str(order.pk),
            'payments': {'captures': [{
                'id': 'CAPTURE-1', 'status': status,
                'amount': {'value': str(amount if amount is not None else order.total_amount),
                           'currency_code': currency or store.currency()},
            }]},
        }],
    }


def relay():
    """Los correos salen por EsfuerzoVZ: en los tests se interceptan."""
    return mock.patch('evz_core.mail_relay.send_relay_email', return_value=True)


@override_settings(MEDIA_ROOT=MEDIA, FRONTEND_URL='https://adela.test')
class CheckoutTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        patcher = mock.patch.object(paypal, 'is_configured', return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        cat = Category.objects.create(name='Libros PDF')
        self.ebook = Product.objects.create(name='Intervención Divina', description='', price=Decimal('9.00'),
                                            category=cat, is_digital=True)
        self.ebook.download_file.save('ebook.pdf', ContentFile(make_pdf()))
        self.session = Product.objects.create(name='Primera Cita', description='', price=Decimal('0'), category=cat)
        self.user = User.objects.create_user(email='ana@example.org', password='x', first_name='Ana')

    def checkout(self, items, **extra):
        return self.api.post('/api/payments/checkout/', {'items': items, **extra}, format='json')

    def pay(self, receipt):
        order = Order.objects.get()
        with mock.patch.object(paypal, 'capture_order', return_value=captured(order)), relay() as mail, \
                self.captureOnCommitCallbacks(execute=True):
            res = self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        return res, mail

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-ORDER-1'})
    def test_checkout_uses_server_prices(self, create_order):
        res = self.checkout([{'product_id': self.ebook.pk, 'quantity': 3, 'price': '0.01'}],
                            customer_email='invitada@example.org')
        self.assertEqual(res.status_code, 201)
        order = Order.objects.get()
        # Digital: cantidad 1, precio del catálogo, no el enviado.
        self.assertEqual(order.total_amount, Decimal('9.00'))
        self.assertEqual((order.payment_method, order.payment_reference), ('paypal', 'PAYPAL-ORDER-1'))
        self.assertEqual(create_order.call_args.kwargs['amount'], Decimal('9.00'))
        self.assertEqual(create_order.call_args.kwargs['shipping_preference'], 'NO_SHIPPING')

    def test_guest_needs_email_and_cart_needs_items(self):
        self.assertEqual(self.checkout([{'product_id': self.ebook.pk}]).status_code, 400)
        self.assertEqual(self.checkout([], customer_email='a@b.org').status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_plan_products_cannot_be_bought_as_items(self):
        Plan.objects.create(product=self.ebook, grants=['escaner'])
        res = self.checkout([{'product_id': self.ebook.pk}], customer_email='a@b.org')
        self.assertEqual(res.status_code, 400)

    def test_free_order_completes_without_paypal(self):
        self.api.force_authenticate(self.user)
        with relay():
            res = self.checkout([{'product_id': self.session.pk}])
        self.assertEqual(res.json()['status'], 'completed')
        order = Order.objects.get()
        self.assertEqual((order.user, order.status), (self.user, 'completed'))
        self.assertFalse(Transaction.objects.exists())

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-ORDER-1'})
    def test_capture_completes_order_once(self, _):
        receipt = self.checkout([{'product_id': self.ebook.pk}], customer_email='invitada@example.org').json()['receipt']
        res, mail = self.pay(receipt)
        self.assertEqual(res.json()['status'], 'completed')
        self.assertEqual(Transaction.objects.get().amount, Decimal('9.00'))
        download = Download.objects.get()
        self.assertTrue(download.qr_image.name.endswith('.png'))
        mail.assert_called_once()
        url = f'https://adela.test/verificar/{download.token}'
        self.assertIn(url, mail.call_args.kwargs['body_text'])
        self.assertEqual(mail.call_args.kwargs['links'][0]['url'], url)

        # Segunda captura (o webhook): no duplica ingreso ni descarga.
        with mock.patch.object(paypal, 'capture_order') as again:
            self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        again.assert_not_called()
        self.assertEqual(Transaction.objects.count(), 1)
        self.assertEqual(Download.objects.count(), 1)

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-ORDER-1'})
    def test_capture_with_wrong_amount_is_not_completed(self, _):
        receipt = self.checkout([{'product_id': self.ebook.pk}], customer_email='a@b.org').json()['receipt']
        order = Order.objects.get()
        with mock.patch.object(paypal, 'capture_order', return_value=captured(order, amount='0.01')):
            res = self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        self.assertEqual(res.json()['status'], 'pending')
        self.assertFalse(Transaction.objects.exists())
        self.assertIn('distinto', Order.objects.get().notes[-1]['text'])

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-ORDER-1'})
    def test_already_captured_falls_back_to_get_order(self, _):
        receipt = self.checkout([{'product_id': self.ebook.pk}], customer_email='a@b.org').json()['receipt']
        order = Order.objects.get()
        with mock.patch.object(paypal, 'capture_order', side_effect=paypal.PayPalError('x', status=422)), \
                mock.patch.object(paypal, 'get_order', return_value=captured(order)), relay():
            res = self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        self.assertEqual(res.json()['status'], 'completed')

    def test_receipt_rejects_tampered_token(self):
        self.assertEqual(self.api.get('/api/payments/receipt/1:abc:def/').status_code, 404)
        self.assertEqual(self.api.post('/api/payments/checkout/1:abc:def/capture/').status_code, 404)

    def test_download_is_single_use_and_stamped(self):
        self.api.force_authenticate(self.user)
        with mock.patch.object(paypal, 'create_order', return_value={'id': 'P-2'}):
            receipt = self.checkout([{'product_id': self.ebook.pk}]).json()['receipt']
        self.pay(receipt)
        token = Download.objects.get().token

        receipt_data = self.api.get(f'/api/payments/receipt/{receipt}/').json()
        self.assertEqual(receipt_data['downloads'][0]['token'], str(token))
        self.assertIsNone(receipt_data['booking'])
        self.assertEqual(self.api.get('/api/store/downloads/mine/').json()[0]['available'], True)

        res = self.api.get(f'/api/store/downloads/{token}/file/')
        self.assertEqual(res.status_code, 200)
        pdf = PdfReader(BytesIO(b''.join(res.streaming_content)))
        self.assertEqual(len(pdf.pages), 2)
        self.assertTrue(pdf.pages[1].get('/Resources', {}).get('/XObject'))  # QR en la página 2
        self.assertEqual(self.api.get(f'/api/store/downloads/{token}/file/').status_code, 410)

    def test_unpaid_download_is_forbidden(self):
        with mock.patch.object(paypal, 'create_order', return_value={'id': 'P-3'}):
            self.checkout([{'product_id': self.ebook.pk}], customer_email='a@b.org')
        download = Download.objects.create(order_item=Order.objects.get().items.get())
        self.assertEqual(self.api.get(f'/api/store/downloads/{download.token}/file/').status_code, 403)

    def test_services_with_duration_are_not_sold_in_store(self):
        self.session.duration = '60 min'
        self.session.save()
        res = self.checkout([{'product_id': self.session.pk}], customer_email='a@b.org')
        self.assertEqual(res.status_code, 400)
        ids = [p['id'] for p in self.api.get('/api/store/products/', {'sellable': 1}).json()]
        self.assertNotIn(self.session.pk, ids)

    def test_store_lists_products_without_plans_or_file_paths(self):
        Plan.objects.create(product=self.session, grants=['*'])
        data = self.api.get('/api/store/products/', {'sellable': 1}).json()
        self.assertEqual([p['id'] for p in data], [self.ebook.pk])
        self.assertTrue(data[0]['is_digital'])
        self.assertNotIn('download_file', data[0])  # el archivo no se publica

    def test_orders_cannot_be_created_without_payment(self):
        res = self.api.post('/api/store/orders/', {'items': [{'product_id': self.ebook.pk}]}, format='json')
        self.assertIn(res.status_code, (401, 403))
        self.assertFalse(Order.objects.exists())


@override_settings(FRONTEND_URL='https://adela.test')
class ManualPaymentTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        cat = Category.objects.create(name='Libros')
        self.book = Product.objects.create(name='El Mapa de tus Muros', description='', price=Decimal('7.00'),
                                           category=cat)
        self.zelle = PaymentMethod.objects.create(kind='zelle', holder='Adela', email_or_phone='adela@example.org')
        self.staff = User.objects.create_user(email='staff@example.org', password='x', is_staff=True)

    def start(self):
        res = self.api.post('/api/payments/checkout/', {
            'items': [{'product_id': self.book.pk}], 'customer_email': 'cliente@example.org', 'method': self.zelle.pk,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.json()

    def test_config_lists_active_methods(self):
        PaymentMethod.objects.create(kind='crypto', network='TRC20', wallet_address='T123', is_active=False)
        methods = self.api.get('/api/payments/config/').json()['manual_methods']
        self.assertEqual([m['name'] for m in methods], ['Zelle'])
        self.assertIn({'label': 'Email o teléfono de zelle', 'value': 'adela@example.org'}, methods[0]['details'])

    def test_submit_and_confirm(self):
        data = self.start()
        self.assertEqual(data['manual']['id'], self.zelle.pk)
        with relay() as mail, self.captureOnCommitCallbacks(execute=True):
            res = self.api.post(f"/api/payments/checkout/{data['receipt']}/manual/", {'reference': 'ZL-123'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['manual_payment']['status'], 'pending')
        mail.assert_called_once()  # "recibimos tu pago"
        payment = ManualPayment.objects.get()

        self.api.force_authenticate(self.staff)
        self.assertEqual(self.api.get('/api/payments/manual/', {'status': 'pending'}).json()[0]['id'], payment.pk)
        with relay(), self.captureOnCommitCallbacks(execute=True):
            res = self.api.post(f'/api/payments/manual/{payment.pk}/confirm/')
        self.assertEqual(res.json()['order']['status'], 'completed')
        tx = Transaction.objects.get()
        self.assertEqual((tx.amount, tx.method), (Decimal('7.00'), 'zelle'))
        # La misma referencia no puede pagar otro pedido.
        self.api.force_authenticate(None)
        other = self.start()
        res = self.api.post(f"/api/payments/checkout/{other['receipt']}/manual/", {'reference': 'zl-123'})
        self.assertEqual(res.status_code, 400)

    def test_reject_cancels_order(self):
        data = self.start()
        with relay():
            self.api.post(f"/api/payments/checkout/{data['receipt']}/manual/", {'reference': 'X'})
        payment = ManualPayment.objects.get()
        self.api.force_authenticate(self.staff)
        with relay():
            res = self.api.post(f'/api/payments/manual/{payment.pk}/reject/', {'reason': 'No llegó.'})
        self.assertEqual(res.json()['order']['status'], 'cancelled')
        self.assertFalse(Transaction.objects.exists())

    def test_only_staff_reviews(self):
        data = self.start()
        with relay():
            self.api.post(f"/api/payments/checkout/{data['receipt']}/manual/", {'reference': 'X'})
        payment = ManualPayment.objects.get()
        self.assertIn(self.api.get('/api/payments/manual/').status_code, (401, 403))
        self.assertIn(self.api.post(f'/api/payments/manual/{payment.pk}/confirm/').status_code, (401, 403))

    def test_paypal_order_does_not_accept_manual_payment(self):
        with mock.patch.object(paypal, 'is_configured', return_value=True), \
                mock.patch.object(paypal, 'create_order', return_value={'id': 'P-9'}):
            receipt = self.api.post('/api/payments/checkout/', {
                'items': [{'product_id': self.book.pk}], 'customer_email': 'c@example.org',
            }, format='json').json()['receipt']
        res = self.api.post(f'/api/payments/checkout/{receipt}/manual/', {'reference': 'X'})
        self.assertEqual(res.status_code, 400)


class SubscriptionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        cat = Category.objects.create(name='Suscripciones')
        product = Product.objects.create(name='Escáner Premium', description='', price=Decimal('7.99'), category=cat)
        self.plan = Plan.objects.create(product=product, grants=['escaner'],
                                        gateway_refs={'paypal': {'plan': 'P-PLAN'}})
        self.user = User.objects.create_user(email='ana@example.org', password='x')
        self.other = User.objects.create_user(email='otro@example.org', password='x')

    def subscribe(self):
        self.api.force_authenticate(self.user)
        with mock.patch.object(paypal, 'create_subscription', return_value={
            'id': 'I-SUB', 'links': [{'rel': 'approve', 'href': 'https://paypal.test/approve'}],
        }):
            return self.api.post('/api/payments/subscriptions/', {'plan': self.plan.pk}, format='json')

    def webhook(self, event, verified=True):
        with mock.patch.object(paypal, 'verify_webhook', return_value=verified):
            return APIClient().post('/api/payments/paypal/webhook/', event, format='json')

    def grants(self):
        return self.api.get('/api/store/access/').json()['grants']

    def test_subscription_flow_grants_access_and_records_payments(self):
        res = self.subscribe()
        self.assertEqual(res.json()['approve_url'], 'https://paypal.test/approve')
        self.assertEqual(self.grants(), [])

        self.webhook({'id': 'WH-1', 'event_type': 'BILLING.SUBSCRIPTION.ACTIVATED', 'resource': {
            'id': 'I-SUB', 'status': 'ACTIVE', 'billing_info': {'next_billing_time': '2030-01-01T00:00:00Z'},
        }})
        self.assertEqual(self.grants(), ['escaner'])
        self.assertEqual(self.api.get('/api/store/subscriptions/mine/').json()[0]['status'], 'ACTIVE')

        sale = {'id': 'WH-2', 'event_type': 'PAYMENT.SALE.COMPLETED', 'resource': {
            'id': 'SALE-1', 'billing_agreement_id': 'I-SUB', 'create_time': '2029-12-01T10:00:00Z',
            'amount': {'total': '7.99', 'currency': store.currency()},
        }}
        with mock.patch.object(paypal, 'get_subscription', return_value={'status': 'ACTIVE'}):
            self.webhook(sale)
            self.webhook(sale)  # PayPal reintenta: mismo evento
            self.webhook({**sale, 'id': 'WH-3'})  # mismo cobro, otro evento
        payment = SubscriptionPayment.objects.get()
        self.assertEqual((payment.order.user, payment.order.status), (self.user, 'completed'))
        self.assertEqual(Transaction.objects.get().amount, Decimal('7.99'))
        self.assertEqual(self.api.get('/api/store/orders/mine/').json()[0]['id'], payment.order.pk)

    def test_unverified_webhook_is_rejected(self):
        self.subscribe()
        res = self.webhook({'id': 'WH-X', 'event_type': 'BILLING.SUBSCRIPTION.ACTIVATED',
                            'resource': {'id': 'I-SUB', 'status': 'ACTIVE'}}, verified=False)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(WebhookEvent.objects.exists())
        self.assertEqual(Subscription.objects.get().status, 'APPROVAL_PENDING')

    @override_settings(PAYPAL_WEBHOOK_ID='')
    def test_webhook_without_id_configured_is_rejected(self):
        res = APIClient().post('/api/payments/paypal/webhook/', {'id': 'WH', 'event_type': 'X'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_cancel_keeps_access_until_period_end(self):
        self.subscribe()
        sub = Subscription.objects.get()
        sub.status = 'ACTIVE'
        sub.current_period_end = '2030-01-01T00:00:00Z'
        sub.save()
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.post(f'/api/payments/subscriptions/{sub.pk}/cancel/').status_code, 404)
        self.api.force_authenticate(self.user)
        with mock.patch.object(paypal, 'cancel_subscription', return_value={}):
            res = self.api.post(f'/api/payments/subscriptions/{sub.pk}/cancel/')
        self.assertEqual(res.json()['status'], 'CANCELLED')
        self.assertEqual(self.grants(), ['escaner'])

    def test_cannot_subscribe_twice(self):
        self.subscribe()
        Subscription.objects.update(status='ACTIVE')
        self.assertEqual(self.subscribe().status_code, 400)
