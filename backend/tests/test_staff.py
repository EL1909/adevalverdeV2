"""Panel de Adela (/cuenta → Tienda, Calendario): permisos y acciones de staff."""

import datetime
import shutil
import tempfile
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from evz_calendars.availability import business_tz
from evz_calendars.models import Appointment, TimeBlock, WeeklySchedule
from evz_store.models import Category, Order, Product
from rest_framework.test import APIClient

from accounts.models import User
from bookings import gcal

MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class StaffStoreTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.cat = Category.objects.create(name='Libros')
        self.staff = User.objects.create_user(email='adela@example.org', password='x', is_staff=True, is_superuser=True)
        self.client_user = User.objects.create_user(email='cliente@example.org', password='x')

    def product_data(self, **extra):
        return {'name': 'Una Vasija Nueva', 'description': 'Libro', 'price': '21.00', 'category': self.cat.pk,
                'is_active': 'true', **extra}

    def test_only_staff_manages_products(self):
        self.assertIn(self.api.post('/api/store/products/', self.product_data()).status_code, (401, 403))
        self.api.force_authenticate(self.client_user)
        self.assertEqual(self.api.post('/api/store/products/', self.product_data()).status_code, 403)
        self.assertEqual(self.api.get('/api/store/orders/').status_code, 403)

    def test_digital_product_needs_its_file_and_keeps_it_private(self):
        self.api.force_authenticate(self.staff)
        res = self.api.post('/api/store/products/', self.product_data(is_digital='true'))
        self.assertEqual(res.status_code, 400)
        pdf = SimpleUploadedFile('vasija.pdf', b'%PDF-1.4 x', content_type='application/pdf')
        res = self.api.post('/api/store/products/', self.product_data(is_digital='true', download_file=pdf))
        self.assertEqual(res.status_code, 201, res.data)
        product = Product.objects.get()
        self.assertTrue(product.download_file.name.startswith('store/private/downloads/vasija-'))
        self.assertTrue(res.data['has_download'])
        # El público ve el producto, no la ruta del archivo.
        self.api.force_authenticate(None)
        self.assertNotIn('download_file', self.api.get(f'/api/store/products/{product.pk}/').data)

    def test_staff_edits_price_without_touching_the_file(self):
        self.api.force_authenticate(self.staff)
        product = Product.objects.create(name='Libro', description='', price=Decimal('5'), category=self.cat)
        res = self.api.patch(f'/api/store/products/{product.pk}/', {'price': '7.00'}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        product.refresh_from_db()
        self.assertEqual(product.price, Decimal('7.00'))


@mock.patch.object(gcal, 'delete_event', return_value=True)
@mock.patch.object(gcal, 'create_event', return_value='EVENT-1')
class StaffCalendarTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.staff = User.objects.create_user(email='adela@example.org', password='x', is_staff=True, is_superuser=True)
        self.api.force_authenticate(self.staff)
        cat = Category.objects.create(name='Sesiones')
        self.session = Product.objects.create(name='Mentoría 1:1', description='', price=Decimal('222'),
                                              duration='90 min', category=cat)

    def booked_order(self):
        start = datetime.datetime.combine(datetime.date.today() + datetime.timedelta(days=5), datetime.time(10),
                                          tzinfo=business_tz())
        order = Order.objects.create(customer_name='Ana', customer_email='ana@example.org', status='pending')
        appt = Appointment.objects.create(order=order, kind='asesoria', customer_name='Ana',
                                          customer_email='ana@example.org', start_time=start,
                                          end_time=start + datetime.timedelta(minutes=90), status='pending')
        return order, appt

    def test_cancelling_an_order_releases_its_booking(self, *_):
        order, appt = self.booked_order()
        res = self.api.post(f'/api/store/orders/{order.pk}/cancel/', {'reason': 'Cliente lo pidió'}, format='json')
        self.assertEqual(res.status_code, 200)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'cancelled')
        self.assertIn('Cliente lo pidió', order.__class__.objects.get(pk=order.pk).notes[-1]['text'])

    def test_schedule_and_blocks(self, *_):
        day = WeeklySchedule.objects.create(weekday=0, opens_at=datetime.time(9), closes_at=datetime.time(19))
        res = self.api.patch(f'/api/calendars/schedule/{day.pk}/', {'opens_at': '10:00'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        # Un bloqueo sin zona se interpreta en hora de Madrid.
        res = self.api.post('/api/calendars/blocks/', {
            'start': '2030-08-01T00:00', 'end': '2030-08-15T23:59', 'reason': 'vacation', 'note': 'Verano',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        block = TimeBlock.objects.get()
        self.assertEqual(block.start.astimezone(business_tz()).hour, 0)
        events = self.api.get('/api/calendars/appointments/').json()
        self.assertTrue(any(e.get('display') == 'background' for e in events))
