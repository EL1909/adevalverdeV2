"""Leads (evz_crm) y cita manual del panel (evz_calendars.booking)."""

import datetime
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from evz_calendars import gcal
from evz_calendars.availability import business_tz
from evz_calendars.booking import services as booking
from evz_calendars.models import Appointment, TimeBlock
from evz_crm.models import Client
from evz_crm.services import CLIENT_TAG, LEAD_TAG, promote_to_client, resolve_or_create_client
from evz_payments.models import PaymentMethod
from evz_store.models import Category, Order, Product
from evz_store.services import mark_paid
from evz_treasury.models import Method, Transaction
from rest_framework.test import APIClient

from accounts.models import User
from tests.test_bookings import at, next_weekday


class ClientServiceTests(TestCase):
    def test_reuses_by_email_then_phone_and_only_adds_tags(self):
        a = resolve_or_create_client('Ana', 'Ana@Example.org', tags=[LEAD_TAG, 'Web'], note='Alta')
        self.assertEqual(a.tags, [LEAD_TAG, 'Web'])
        self.assertEqual(a.notes[0]['text'], 'Alta')
        same = resolve_or_create_client('Ana Ruiz', 'ana@example.org', '600', tags=['Web', 'Panel'])
        self.assertEqual(same.pk, a.pk)
        self.assertEqual(same.tags, [LEAD_TAG, 'Web', 'Panel'])
        self.assertEqual(same.name, 'Ana')  # la ficha no se pisa
        b = resolve_or_create_client('Bea', phone='700')
        self.assertEqual(resolve_or_create_client('Otra', phone='700').pk, b.pk)
        self.assertIsNone(resolve_or_create_client(''))
        self.assertEqual(Client.objects.count(), 2)

    def test_promotion_is_idempotent(self):
        c = resolve_or_create_client('Ana', 'ana@example.org', tags=[LEAD_TAG])
        self.assertTrue(promote_to_client(c))
        self.assertEqual(c.tags, [CLIENT_TAG])
        self.assertFalse(promote_to_client(c))
        self.assertEqual(len(c.notes), 1)


@override_settings(FRONTEND_URL='https://adela.test')
@mock.patch.object(gcal, 'delete_event', return_value=True)
@mock.patch.object(gcal, 'create_event', return_value='EVENT-1')
class BookingLeadTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        relay = mock.patch('evz_calendars.booking.services.send_relay_email', return_value=True)
        self.mail = relay.start()
        self.addCleanup(relay.stop)
        store_relay = mock.patch('evz_core.mail_relay.send_relay_email', return_value=True)
        store_relay.start()
        self.addCleanup(store_relay.stop)
        cat = Category.objects.create(name='Sesiones')
        self.session = Product.objects.create(name='Mentoría 1:1', description='', price=Decimal('222'),
                                              duration='90 min', category=cat)
        self.free = Product.objects.create(name='Primera Cita', description='', price=Decimal('0'),
                                           duration='60 min', category=cat)
        self.zelle = PaymentMethod.objects.create(kind='zelle', holder='Adela', email_or_phone='adela@example.org')
        self.staff = User.objects.create_user(email='adela@example.org', password='x', is_staff=True, is_superuser=True)
        self.day = next_weekday()

    def web_booking(self, product, hour, email='invitada@example.org'):
        return booking.create_booking(product=product, start=at(self.day, hour), user=None,
                                      customer_name='Invitada', customer_email=email)

    def manual(self, **data):
        self.api.force_authenticate(self.staff)
        payload = {'start': at(self.day, 10).isoformat(), 'customer_name': 'Luz', 'customer_email': 'luz@example.org',
                   'payment': 'courtesy', **data}
        return self.api.post('/api/calendars/appointments/manual/', payload, format='json')

    # ── Reserva web ──

    def test_web_booking_creates_a_lead_and_payment_promotes_it(self, *_):
        appt = self.web_booking(self.session, 9)  # sesiones de 90 min: 9:00, 10:30…
        client = appt.client
        self.assertEqual(client.tags, [LEAD_TAG, 'Web'])
        self.assertEqual(appt.source, 'web')
        again = self.web_booking(self.free, 14, email='INVITADA@example.org')
        self.assertEqual(again.client_id, client.pk)
        mark_paid(appt.order, method=Method.PAYPAL)
        client.refresh_from_db()
        self.assertEqual(client.tags, ['Web', CLIENT_TAG])

    def test_free_booking_keeps_the_lead(self, *_):
        appt = self.web_booking(self.free, 10)
        from evz_payments.services import complete_free_order
        complete_free_order(appt.order)
        appt.client.refresh_from_db()
        self.assertIn(LEAD_TAG, appt.client.tags)

    # ── Cita manual ──

    def test_manual_courtesy_creates_lead_without_order(self, create_event, _):
        res = self.manual(service=self.session.pk, notes='Viene recomendada')
        self.assertEqual(res.status_code, 201, res.data)
        appt = Appointment.objects.get(pk=res.data['id'])
        self.assertEqual((appt.status, appt.source, appt.order_id), ('confirmed', 'staff', None))
        self.assertEqual(appt.end_time - appt.start_time, datetime.timedelta(minutes=90))
        self.assertEqual(appt.google_event_id, 'EVENT-1')
        self.assertEqual(appt.client.tags, [LEAD_TAG])
        self.assertEqual(appt.notes[-1]['author_email'], 'adela@example.org')
        self.mail.assert_not_called()

    def test_manual_paid_records_income_and_promotes(self, *_):
        res = self.manual(service=self.session.pk, payment='paid', paid_method='zelle', send_email=True)
        self.assertEqual(res.status_code, 201, res.data)
        appt = Appointment.objects.get(pk=res.data['id'])
        self.assertEqual(appt.status, 'confirmed')
        self.assertEqual(appt.order.status, 'completed')
        self.assertEqual(Transaction.objects.get().amount, Decimal('222'))
        self.assertEqual(appt.client.tags, [CLIENT_TAG])
        self.assertEqual(appt.order.payment_method, 'staff:zelle')

    def test_manual_pending_sends_payment_request_and_does_not_expire(self, *_):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.manual(service=self.session.pk, payment='pending', manual_method=self.zelle.pk, send_email=True)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['receipt'])
        appt = Appointment.objects.get(pk=res.data['id'])
        self.assertEqual((appt.status, appt.order.status), ('pending', 'pending'))
        self.assertEqual(self.mail.call_args.kwargs['email_type'], 'appointment_payment_request')
        Appointment.objects.filter(pk=appt.pk).update(created_at=timezone.now() - datetime.timedelta(days=5))
        booking.release_expired_holds()
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'pending')

    def test_manual_existing_client(self, *_):
        client = resolve_or_create_client('Ana', 'ana@example.org', tags=[CLIENT_TAG])
        res = self.manual(client_id=client.pk, customer_name='', customer_email='')
        self.assertEqual(res.status_code, 201, res.data)
        appt = Appointment.objects.get(pk=res.data['id'])
        self.assertEqual((appt.client_id, appt.customer_email), (client.pk, 'ana@example.org'))
        client.refresh_from_db()
        self.assertEqual(client.tags, [CLIENT_TAG])

    def test_manual_slot_rules(self, *_):
        self.assertEqual(self.manual().status_code, 201)
        res = self.manual(customer_email='otra@example.org')
        self.assertEqual(res.status_code, 409)
        self.assertFalse(res.data['can_force'])  # encima de otra cita: nunca
        late = at(self.day, 21).isoformat()
        res = self.manual(start=late)
        self.assertEqual((res.status_code, res.data['can_force']), (409, True))
        self.assertEqual(self.manual(start=late, force=True).status_code, 201)
        TimeBlock.objects.create(start=at(self.day, 15), end=at(self.day, 17))
        self.assertEqual(self.manual(start=at(self.day, 15).isoformat()).status_code, 409)

    def test_manual_validation(self, *_):
        self.assertEqual(self.manual(payment='paid').status_code, 400)  # sin servicio
        self.assertEqual(self.manual(service=self.session.pk, payment='pending').status_code, 400)  # sin método
        self.assertEqual(self.manual(customer_name='', customer_email='').status_code, 400)
        res = self.manual(service=self.free.pk, payment='pending', manual_method=self.zelle.pk)
        self.assertEqual(res.status_code, 400)  # gratuito: solo como cortesía
        self.assertFalse(Order.objects.exists())

    def test_manual_is_staff_only(self, *_):
        user = User.objects.create_user(email='ana@example.org', password='x')
        self.api.force_authenticate(user)
        res = self.api.post('/api/calendars/appointments/manual/', {'start': at(self.day, 10).isoformat()}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.api.get('/api/crm/clients/').status_code, 403)

    def test_manual_options(self, *_):
        self.api.force_authenticate(self.staff)
        data = self.api.get('/api/calendars/appointments/manual/').json()
        self.assertEqual({s['name'] for s in data['services']}, {'Mentoría 1:1', 'Primera Cita'})
        self.assertEqual([m['name'] for m in data['manual_methods']], ['Zelle'])
        self.assertIn('zelle', [m['value'] for m in data['paid_methods']])

    # ── API de clientes ──

    def test_client_api_filter_notes_promote_history(self, *_):
        appt = self.web_booking(self.session, 9)  # sesiones de 90 min: 9:00, 10:30…
        resolve_or_create_client('Bea', 'bea@example.org', tags=[CLIENT_TAG])
        self.api.force_authenticate(self.staff)
        leads = self.api.get('/api/crm/clients/', {'tag': LEAD_TAG}).json()
        self.assertEqual([c['email'] for c in leads], ['invitada@example.org'])
        pk = appt.client_id
        res = self.api.post(f'/api/crm/clients/{pk}/message/', {'text': 'Llamar el lunes'}, format='json')
        self.assertEqual(res.json()['notes'][-1]['text'], 'Llamar el lunes')
        history = self.api.get(f'/api/crm/clients/{pk}/history/').json()
        self.assertEqual([a['id'] for a in history['appointments']], [appt.pk])
        self.assertEqual([o['id'] for o in history['orders']], [appt.order_id])
        res = self.api.post(f'/api/crm/clients/{pk}/promote/')
        self.assertEqual(res.json()['tags'], ['Web', CLIENT_TAG])
        events = self.api.get('/api/calendars/appointments/').json()
        self.assertEqual(events[0]['extendedProps']['client_tags'], ['Web', CLIENT_TAG])

    def test_link_command_for_old_appointments(self, *_):
        start = at(self.day, 10)
        order = Order.objects.create(customer_name='Ana', customer_email='ana@example.org', status='completed')
        from evz_store.models import OrderItem
        OrderItem.objects.create(order=order, product=self.session, description='x', quantity=1, unit_price=Decimal('222'))
        Appointment.objects.create(order=order, customer_name='Ana', customer_email='ana@example.org',
                                   start_time=start, end_time=start + datetime.timedelta(hours=1))
        Appointment.objects.create(customer_name='Sin datos', start_time=start, end_time=start)
        out = StringIO()
        call_command('link_appointment_clients', stdout=out)
        self.assertIn('1 citas enlazadas · 1 clientes nuevos · 1 pasaron a cliente', out.getvalue())
        self.assertEqual(Client.objects.get().tags, [CLIENT_TAG])
        call_command('link_appointment_clients', stdout=out)
        self.assertEqual(Client.objects.count(), 1)

    def test_appointment_hours_are_business_time(self, *_):
        self.assertEqual(at(self.day, 10).tzinfo, business_tz())
