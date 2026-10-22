import datetime
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from evz_calendars.availability import business_tz
from evz_calendars.models import Appointment, TimeBlock
from evz_store.models import Category, Order, Product
from rest_framework.test import APIClient

from accounts.models import User
from evz_calendars import gcal
from evz_payments import paypal
from tests.test_payments import captured


def next_weekday(days_ahead=3):
    day = timezone.localdate() + datetime.timedelta(days=days_ahead)
    while day.weekday() >= 5:
        day += datetime.timedelta(days=1)
    return day


def at(day, hour):
    return datetime.datetime.combine(day, datetime.time(hour), tzinfo=business_tz())


@override_settings(FRONTEND_URL='https://adela.test', EVZ_BOOKING_HOLD_MINUTES=30)
@mock.patch.object(gcal, 'delete_event', return_value=True)
@mock.patch.object(gcal, 'create_event', return_value='EVENT-1')
class BookingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        configured = mock.patch.object(paypal, 'is_configured', return_value=True)
        configured.start()
        self.addCleanup(configured.stop)
        # Los correos salen por EsfuerzoVZ: aquí se interceptan.
        relay = mock.patch('evz_calendars.booking.services.send_relay_email', return_value=True)
        self.mail = relay.start()
        self.addCleanup(relay.stop)
        store_relay = mock.patch('evz_core.mail_relay.send_relay_email', return_value=True)
        self.order_mail = store_relay.start()
        self.addCleanup(store_relay.stop)
        cat = Category.objects.create(name='Sesiones')
        self.session = Product.objects.create(name='Sesión individual', description='', price=Decimal('60.00'),
                                              duration='60 min', category=cat)
        self.free = Product.objects.create(name='Primera Cita', description='', price=Decimal('0'),
                                           duration='60 min', category=cat)
        self.user = User.objects.create_user(email='ana@example.org', password='x', first_name='Ana')
        self.day = next_weekday()
        # La sesión gratuita es para quien compró un libro (EVZ_BOOKING_FREE_REQUIRES_PURCHASE).
        self.book_product = Product.objects.create(name='El Misterio de la Sal', description='', price=Decimal('9.99'),
                                                   category=cat, is_digital=True)
        self.bought_book('invitada@example.org')
        self.bought_book(self.user.email, user=self.user)

    def bought_book(self, email, user=None, status='completed', product=None):
        order = Order.objects.create(customer_name='Compradora', customer_email=email, user=user, status=status)
        product = product or self.book_product
        order.items.create(product=product, description=product.name, unit_price=product.price, quantity=1)
        return order

    def slots(self, product=None, day=None):
        res = self.api.get('/api/bookings/slots/', {'service': (product or self.session).pk,
                                                    'date': (day or self.day).isoformat()})
        self.assertEqual(res.status_code, 200)
        return [s['start'] for s in res.data['slots']]

    def book(self, product=None, start=None, **extra):
        data = {'service': (product or self.session).pk, 'start': (start or at(self.day, 10)).isoformat(),
                'customer_name': 'Invitada', 'customer_email': 'invitada@example.org', **extra}
        return self.api.post('/api/bookings/', data, format='json')

    def test_only_services_and_open_days_are_offered(self, *_):
        res = self.api.get('/api/bookings/services/')
        self.assertEqual({p['name'] for p in res.data}, {'Sesión individual', 'Primera Cita'})
        days = self.api.get('/api/bookings/days/', {'service': self.session.pk}).data['days']
        self.assertTrue(days)
        self.assertTrue(all(datetime.date.fromisoformat(d).weekday() < 5 for d in days))
        self.assertNotIn(timezone.localdate().isoformat(), days)  # antelación mínima de 24 h
        # Horario por defecto 9–19 en sesiones de 60 min.
        self.assertEqual(len(self.slots()), 10)
        self.assertIn(at(self.day, 10).isoformat(), self.slots())

    def test_time_blocks_remove_slots(self, *_):
        TimeBlock.objects.create(start=at(self.day, 9), end=at(self.day, 12))
        self.assertNotIn(at(self.day, 10).isoformat(), self.slots())
        self.assertEqual(self.book().status_code, 409)

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'})
    def test_paid_booking_holds_slot_until_paid(self, create_order, create_event, delete_event):
        res = self.book()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['paypal_order_id'], 'PAYPAL-1')
        appt = Appointment.objects.get()
        self.assertEqual((appt.status, appt.order.status), ('pending', 'pending'))
        self.assertEqual(appt.order.total_amount, Decimal('60.00'))
        self.assertEqual(appt.end_time - appt.start_time, datetime.timedelta(minutes=60))
        # Retenido: ya no se ofrece ni se puede reservar otra vez.
        self.assertNotIn(at(self.day, 10).isoformat(), self.slots())
        self.assertEqual(self.book(customer_email='otra@example.org').status_code, 409)

        with mock.patch.object(paypal, 'capture_order', return_value=captured(appt.order)), \
                self.captureOnCommitCallbacks(execute=True):
            res = self.api.post(f"/api/payments/checkout/{res.data['receipt']}/capture/")
        self.assertEqual(res.data['status'], 'completed')
        appt.refresh_from_db()
        self.assertEqual((appt.status, appt.google_event_id), ('confirmed', 'EVENT-1'))
        # Un solo correo: el de la cita, con el evento para el calendario.
        self.mail.assert_called_once()
        self.order_mail.assert_not_called()
        self.assertIn('asesoría', self.mail.call_args.kwargs['subject'])
        self.assertEqual(self.mail.call_args.kwargs['attachments'][0]['filename'], 'asesoria.ics')

        receipt = self.api.get(f"/api/payments/receipt/{res.data['receipt']}/").data
        self.assertEqual(receipt['booking']['status'], 'confirmed')

    def test_free_booking_once_per_email(self, create_event, delete_event):
        res = self.book(self.free)
        self.assertEqual(res.data['status'], 'completed')
        appt = Appointment.objects.get()
        self.assertEqual(appt.status, 'confirmed')
        create_event.assert_called_once()
        res = self.book(self.free, start=at(self.day, 12), customer_email='INVITADA@example.org')
        self.assertEqual(res.status_code, 409)

    def test_free_session_only_for_book_buyers(self, *_):
        stranger = {'customer_email': 'nueva@example.org'}
        res = self.book(self.free, **stranger)
        self.assertEqual(res.status_code, 409)
        self.assertIn('compraron un libro', res.data['error'])
        # Un pedido sin pagar o de algo que no es un libro no cuenta.
        self.bought_book('nueva@example.org', status='pending')
        self.bought_book('nueva@example.org', product=self.session)
        self.assertEqual(self.book(self.free, **stranger).status_code, 409)
        # Comprado como invitada (otro uso de mayúsculas): cuenta por email.
        self.bought_book('Nueva@Example.org')
        self.assertEqual(self.book(self.free, **stranger).status_code, 201)

    def test_free_session_counts_purchases_of_the_account(self, *_):
        other = User.objects.create_user(email='luz@example.org', password='x')
        self.bought_book('otro-email@example.org', user=other)
        self.api.force_authenticate(other)
        self.assertEqual(self.book(self.free).status_code, 201)

    def courtesy(self):
        return Product.objects.create(name='Sesión de cortesía', description='', price=Decimal('30.00'),
                                      duration='15 min', category=self.session.category, free_with_purchase=True)

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'})
    def test_courtesy_is_free_once_for_book_buyers(self, *_):
        courtesy = self.courtesy()
        res = self.book(courtesy)
        self.assertEqual(res.data['status'], 'completed')
        appt = Appointment.objects.get()
        self.assertEqual((appt.status, appt.order.total_amount), ('confirmed', 0))
        # La segunda vez, con el mismo email, se paga.
        res = self.book(courtesy, start=at(self.day, 12), customer_email='INVITADA@example.org')
        self.assertEqual(res.data['paypal_order_id'], 'PAYPAL-1')
        self.assertEqual(Appointment.objects.latest('pk').order.total_amount, Decimal('30.00'))

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'})
    def test_courtesy_is_paid_without_a_book(self, *_):
        courtesy = self.courtesy()
        self.bought_book('nueva@example.org', product=self.session)  # no es un libro
        res = self.book(courtesy, customer_email='nueva@example.org')
        self.assertEqual(res.data['paypal_order_id'], 'PAYPAL-1')
        self.assertEqual(Appointment.objects.get().order.total_amount, Decimal('30.00'))

    def test_free_check(self, *_):
        courtesy = self.courtesy()
        url = '/api/bookings/free-check/'
        # Sin sesión: solo sí o no, sin decir qué compró.
        res = self.api.get(url, {'service': courtesy.pk, 'email': 'invitada@example.org'})
        self.assertEqual((res.data['free'], res.data['has_purchase']), (True, True))
        self.assertNotIn('purchases', res.data)
        res = self.api.get(url, {'service': courtesy.pk, 'email': 'nueva@example.org'})
        self.assertEqual((res.data['free'], res.data['has_purchase']), (False, False))
        self.assertEqual(self.api.get(url, {'service': courtesy.pk}).status_code, 400)
        # Con sesión: su cuenta, y lista los libros.
        self.api.force_authenticate(self.user)
        res = self.api.get(url, {'service': courtesy.pk, 'email': 'otra@example.org'})
        self.assertEqual((res.data['free'], res.data['purchases']), (True, ['El Misterio de la Sal']))
        self.book(courtesy)
        res = self.api.get(url, {'service': courtesy.pk})
        self.assertEqual((res.data['free'], res.data['used']), (False, True))

    def test_rejects_unoffered_times(self, *_):
        self.assertEqual(self.book(start=at(self.day, 10) + datetime.timedelta(minutes=15)).status_code, 409)
        self.assertEqual(self.book(start=at(self.day, 20)).status_code, 409)
        self.assertEqual(self.book(start=timezone.now() + datetime.timedelta(hours=2)).status_code, 409)

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'})
    def test_expired_hold_frees_slot_and_late_payment(self, *_):
        receipt = self.book().data['receipt']
        Appointment.objects.update(created_at=timezone.now() - datetime.timedelta(minutes=31))
        self.assertIn(at(self.day, 10).isoformat(), self.slots())  # liberado
        appt = Appointment.objects.get()
        self.assertEqual((appt.status, appt.order.status), ('cancelled', 'cancelled'))

        # Otra persona toma el horario: el pago tardío no se cobra.
        self.api.force_authenticate(self.user)
        self.assertEqual(self.book().status_code, 201)
        self.api.force_authenticate(None)
        with mock.patch.object(paypal, 'capture_order') as capture:
            res = self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        self.assertEqual(res.status_code, 409)
        capture.assert_not_called()

    @mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'})
    def test_late_payment_with_free_slot_confirms(self, *_):
        receipt = self.book().data['receipt']
        Appointment.objects.update(created_at=timezone.now() - datetime.timedelta(minutes=31))
        self.slots()  # libera la retención
        appt = Appointment.objects.get()
        with mock.patch.object(paypal, 'capture_order', return_value=captured(appt.order)):
            res = self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        self.assertEqual(res.data['status'], 'completed')
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'confirmed')

    def test_refund_cancels_appointment_and_event(self, create_event, delete_event):
        from evz_payments.webhooks import handle_paypal_event as handle_event
        self.api.force_authenticate(self.user)
        with mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'}):
            receipt = self.book().data['receipt']
        order = Appointment.objects.get().order
        with mock.patch.object(paypal, 'capture_order', return_value=captured(order)):
            self.api.post(f'/api/payments/checkout/{receipt}/capture/')
        handle_event({'event_type': 'PAYMENT.CAPTURE.REFUNDED', 'resource': {
            'id': 'REFUND-1', 'supplementary_data': {'related_ids': {'order_id': 'PAYPAL-1'}}}})
        appt = Appointment.objects.get()
        self.assertEqual(appt.status, 'cancelled')
        delete_event.assert_called_once_with('EVENT-1')

    def test_my_bookings_and_cancel(self, create_event, delete_event):
        self.api.force_authenticate(self.user)
        self.book(self.free)
        mine = self.api.get('/api/bookings/mine/').data
        self.assertEqual(len(mine), 1)
        self.assertTrue(mine[0]['can_cancel'])
        res = self.api.post(f"/api/bookings/{mine[0]['id']}/cancel/")
        self.assertEqual(res.data['status'], 'cancelled')
        delete_event.assert_called_once_with('EVENT-1')
        self.assertIn(at(self.day, 10).isoformat(), self.slots())

    def test_paid_booking_cannot_be_cancelled_online(self, *_):
        self.api.force_authenticate(self.user)
        with mock.patch.object(paypal, 'create_order', return_value={'id': 'PAYPAL-1'}):
            self.book()
        appt = Appointment.objects.get()
        self.assertEqual(self.api.post(f'/api/bookings/{appt.pk}/cancel/').status_code, 400)

    def test_backbone_management_apis_are_not_public(self, *_):
        # La agenda del backbone solo se publica para el staff y sin su POST público.
        self.assertEqual(self.api.post('/api/calendars/appointments/', {}).status_code, 405)
        self.assertIn(self.api.get('/api/calendars/appointments/').status_code, (401, 403))
        self.assertIn(self.api.get('/api/calendars/blocks/').status_code, (401, 403))
        self.assertIn(self.api.post('/api/store/orders/', {}).status_code, (401, 403))
        self.api.force_authenticate(self.user)
        self.assertEqual(self.api.get('/api/store/orders/mine/').status_code, 200)
