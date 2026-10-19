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
        order = Order.objects.get()
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
