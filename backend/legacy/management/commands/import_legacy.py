"""
Importa usuarios, catálogo, pedidos, descargas y citas del sitio anterior
(Django 4.2 + allauth, ../adevalverde) leyendo su SQLite en solo lectura.

    manage.py import_legacy --db ../adevalverde/db.sqlite3 \
        --media ../adevalverde/media --exclude-email guest@example.com \
        --rename-email viejo@example.com=nuevo@example.com --dry-run

Se corre una vez, sobre una base sin catálogo ni pedidos. Conserva los IDs de
categorías, productos y pedidos (aparecen en enlaces, QR y correos ya
enviados); los usuarios pasan a UUID. Los pedidos fallidos (pagos que
nunca se completaron) no se importan. Todo ocurre en una transacción: si algo
falla no queda nada a medias, y con --dry-run se deshace al final.
"""

import json
import shutil
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import identify_hasher
from django.core.management import BaseCommand, CommandError, call_command
from django.core.management.color import no_style
from django.db import connection, transaction
from django.utils import timezone

from evz_calendars.booking import services as bookings
from evz_core.models import BusinessProfile
from evz_calendars.models import Appointment, AppointmentItem, CalendarSettings
from evz_store.models import Category, Download, Order, OrderItem, Product
from evz_treasury.models import Direction, Method, Transaction

User = get_user_model()

# Pendientes = nunca se pagaron: se importan cancelados (historial, sin acceso).
STATUS_MAP = {'completed': 'completed', 'pending': 'cancelled'}
SKIPPED_STATUS = 'failed'  # pagos que nunca se completaron: no se importan

# Correos de compradores del sandbox de PayPal: esos pagos nunca movieron dinero.
SANDBOX_DOMAINS = ('personal.example.com', 'business.example.com')


def as_utc(value):
    """El sitio anterior usaba USE_TZ=True y TIME_ZONE='UTC'."""
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=dt_timezone.utc)


def parse_json(raw):
    try:
        data = json.loads(raw or '{}')
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


class Command(BaseCommand):
    help = 'Importa los datos del sitio anterior (SQLite) a esta base.'

    def add_arguments(self, parser):
        parser.add_argument('--db', required=True, help='Ruta al db.sqlite3 del sitio anterior.')
        parser.add_argument('--media', help='MEDIA_ROOT del sitio anterior, para copiar archivos.')
        parser.add_argument(
            '--exclude-email', action='append', default=[],
            help='Cuenta a no importar (prueba, invitado). Repetible. Sus pedidos quedan como invitado.',
        )
        parser.add_argument(
            '--rename-email', action='append', default=[], metavar='VIEJO=NUEVO',
            help='Cambia el email de una cuenta al importarla. Repetible.',
        )
        parser.add_argument('--dry-run', action='store_true', help='Importa y deshace: solo muestra el informe.')

    def handle(self, *args, **opts):
        db_path = Path(opts['db']).resolve()
        if not db_path.exists():
            raise CommandError(f'No existe {db_path}')
        if Product.objects.exists() or Order.objects.exists():
            raise CommandError('La base ya tiene productos o pedidos: el importador corre una sola vez.')

        self.src = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
        self.src.row_factory = sqlite3.Row
        self.excluded = {e.strip().lower() for e in opts['exclude_email']}
        self.renamed = {}
        for pair in opts['rename_email']:
            old, sep, new = pair.partition('=')
            if not sep or '@' not in old or '@' not in new:
                raise CommandError(f'--rename-email espera VIEJO=NUEVO: {pair}')
            self.renamed[old.strip().lower()] = new.strip().lower()
        self.warnings = []
        self.counts = Counter()
        self.media_files = set()
        self.media_dest = {}  # ruta de origen → ruta nueva, si cambia

        with transaction.atomic():
            self.import_business()
            self.import_users()
            self.import_catalog()
            self.import_orders()
            self.import_downloads()
            self.import_appointments()
            self.reset_sequences()
            self.verify()
            if opts['dry_run']:
                transaction.set_rollback(True)

        if opts['media'] and not opts['dry_run']:
            self.copy_media(Path(opts['media']).resolve())
            call_command('compress_images', stdout=self.stdout)
        elif opts['media']:
            self.check_media(Path(opts['media']).resolve())

        self.report(opts['dry_run'])

    def rows(self, sql, *params):
        return self.src.execute(sql, params).fetchall()

    def import_business(self):
        # La cuenta PayPal de Adela es de EE. UU. y el sitio anterior cobraba en dólares.
        profile = BusinessProfile.load()
        profile.currency = 'USD'
        profile.save()

    # ── Usuarios ────────────────────────────────────────────────────────────

    def import_users(self):
        """
        Email como identidad: cuentas con el mismo email se fusionan en la más
        antigua, que conserva su contraseña y permisos. Las contraseñas que no
        son un hash válido se invalidan (la persona usa "olvidé mi contraseña").
        """
        self.user_map = {}  # id antiguo → User nuevo (o None = invitado)
        by_email = {}

        for row in self.rows('SELECT * FROM auth_user ORDER BY id'):
            email = (row['email'] or '').strip().lower()
            if email in self.renamed:
                email = self.renamed[email]
                self.counts['emails cambiados'] += 1
            if not email or email in self.excluded:
                self.user_map[row['id']] = None
                self.counts['usuarios omitidos'] += 1
                continue

            if email in by_email:
                self.user_map[row['id']] = by_email[email]
                self.counts['usuarios fusionados'] += 1
                self.warnings.append(
                    f"Usuario #{row['id']} ({row['username']}) fusionado en {email}: "
                    'se conservan contraseña y permisos de la cuenta más antigua.'
                )
                continue

            existing = User.objects.filter(email__iexact=email).first()
            if existing:
                user = existing
                self.warnings.append(f'{email} ya existía en esta base: se enlaza sin tocar la cuenta.')
            else:
                user = User(
                    email=email,
                    first_name=row['first_name'] or '',
                    last_name=row['last_name'] or '',
                    is_staff=bool(row['is_staff']),
                    is_superuser=bool(row['is_superuser']),
                    is_active=bool(row['is_active']),
                    date_joined=as_utc(row['date_joined']) or timezone.now(),
                    last_login=as_utc(row['last_login']),
                )
                try:
                    identify_hasher(row['password'])
                    user.password = row['password']
                except ValueError:
                    user.set_unusable_password()
                    self.warnings.append(
                        f"{email}: la contraseña no era un hash válido; queda inutilizable "
                        '(debe usar "olvidé mi contraseña").'
                    )
                user.save()
                self.counts['usuarios'] += 1

            by_email[email] = user
            self.user_map[row['id']] = user

    # ── Catálogo ────────────────────────────────────────────────────────────

    def import_catalog(self):
        for row in self.rows('SELECT * FROM store_category ORDER BY id'):
            Category.objects.create(
                id=row['id'], name=row['name'],
                display_name=row['display_name'] or '', description=row['description'] or '',
            )
            self.counts['categorías'] += 1

        # Duración de los productos que se reservan como cita (ej. sesiones 1:1).
        durations = {}
        for row in self.rows('SELECT product_id, start_time, end_time FROM calendars_appointment'):
            minutes = int((as_utc(row['end_time']) - as_utc(row['start_time'])).total_seconds() // 60)
            durations.setdefault(row['product_id'], f'{minutes} min')

        fallback = None
        for row in self.rows('SELECT * FROM store_product ORDER BY id'):
            category_id = row['category_id']
            if category_id is None:
                if fallback is None:
                    fallback = Category.objects.create(name='Sin categoría')
                category_id = fallback.id

            # Sin imagen al crear: Product.save() abre el archivo, y puede no
            # estar todavía en este MEDIA_ROOT. Se asigna la ruta con update().
            Product.objects.create(
                id=row['id'], name=row['name'], description=row['description'] or '',
                price=Decimal(str(row['price'])), category_id=category_id,
                is_active=bool(row['is_active']), duration=durations.get(row['id'], ''),
            )
            if row['image']:
                Product.objects.filter(pk=row['id']).update(image=row['image'])
                self.media_files.add(row['image'])

            if row['download_file']:
                # El sitio anterior marcaba como "digital" también las sesiones
                # (para no pedir envío). Aquí digital = hay un archivo que
                # entregar, y va a la carpeta privada (no la sirve nginx).
                # Los enlaces externos (Gamma) no se importan: cada producto
                # tiene su página en el sitio.
                dest = f"store/private/downloads/{Path(row['download_file']).name}"
                Product.objects.filter(pk=row['id']).update(
                    is_digital=bool(row['is_digital']), download_file=dest,
                )
                self.media_files.add(row['download_file'])
                self.media_dest[row['download_file']] = dest
            if row['is_digital'] and not row['download_file']:
                self.warnings.append(
                    f"Producto #{row['id']} ({row['name']}) estaba marcado digital sin archivo: queda como no digital."
                )
            self.counts['productos'] += 1

    # ── Pedidos ─────────────────────────────────────────────────────────────

    def import_orders(self):
        items_by_order = defaultdict(list)
        for row in self.rows('SELECT * FROM store_orderitem ORDER BY id'):
            items_by_order[row['order_id']].append(row)

        self.item_map = {}  # id antiguo de OrderItem → OrderItem nuevo
        for row in self.rows('SELECT * FROM store_order ORDER BY id'):
            if row['paymentStatus'] == SKIPPED_STATUS:
                self.counts['pedidos fallidos omitidos'] += 1
                continue
            user = self.user_map.get(row['user_id'])
            data = parse_json(row['shipping_data'])
            payer_email = (data.get('email') or '').strip().lower()
            sandbox = payer_email.endswith(SANDBOX_DOMAINS)

            name = (data.get('name') or data.get('full_name') or '').strip()
            if user and not name:
                name = user.get_full_name()
            if user:
                email = user.email
            elif payer_email and not sandbox:
                email = payer_email
            else:
                email = ''

            method = (row['payment_method'] or '').upper()
            order = Order.objects.create(
                id=row['id'],
                customer_name=name or 'Invitado',
                customer_email=email,
                status=STATUS_MAP.get(row['paymentStatus'], 'pending'),
                payment_method='paypal' if method == 'PAYPAL' else 'manual',
                payment_reference=row['payment_id'] or '',
                user=user,
            )
            Order.objects.filter(pk=order.pk).update(created_at=as_utc(row['created_at']))
            self.counts[f'pedidos {order.status}'] += 1

            for item in items_by_order.get(row['id'], []):
                product = Product.objects.filter(pk=item['product_id']).first()
                self.item_map[item['id']] = OrderItem.objects.create(
                    order=order, product=product,
                    description=product.name if product else 'Producto eliminado',
                    quantity=item['quantity'], unit_price=Decimal(str(item['price'])),
                )
                self.counts['líneas de pedido'] += 1

            legacy_total = Decimal(str(row['totalAmount']))
            if not items_by_order.get(row['id']) and legacy_total > 0:
                # Pedido sin detalle de líneas: se conserva el importe cobrado.
                OrderItem.objects.create(
                    order=order, description='Pedido importado (sin detalle)', unit_price=legacy_total,
                )
                self.warnings.append(f'Pedido #{order.pk} no tenía líneas: se crea una con el total ({legacy_total}).')

            notes = []
            if sandbox:
                notes.append('Pago de prueba (sandbox de PayPal): no se registra ingreso.')
            if data:
                notes.append(f'Datos de pago/envío del sitio anterior: {json.dumps(data, ensure_ascii=False)}')
            if notes:
                order.notes = [{'author_email': None, 'text': t, 'date': timezone.now().isoformat()} for t in notes]
                order.save(update_fields=['notes'])

            if order.status == 'completed' and legacy_total > 0 and not sandbox:
                Transaction.objects.create(
                    direction=Direction.IN, amount=legacy_total,
                    date=timezone.localtime(as_utc(row['created_at'])).date(),
                    description=f'Pedido #{order.pk} · {order.customer_name} (importado)',
                    method=Method.PAYPAL if method == 'PAYPAL' else Method.OTHER,
                    order=order,
                )
                self.counts['ingresos registrados'] += 1
            elif order.status == 'completed' and sandbox:
                self.counts['pedidos de prueba (sandbox)'] += 1

    # ── Descargas ───────────────────────────────────────────────────────────

    def import_downloads(self):
        for row in self.rows('SELECT * FROM store_downloadable ORDER BY id'):
            item = self.item_map.get(row['order_item_id'])
            if not item:
                self.warnings.append(f"Descarga #{row['id']} apunta a una línea inexistente: omitida.")
                continue
            dl = Download.objects.create(
                order_item=item, token=row['token'], qr_image=row['qr_image'] or None,
                downloaded_at=as_utc(row['downloaded_at']), download_count=1 if row['downloaded_at'] else 0,
            )
            Download.objects.filter(pk=dl.pk).update(created_at=as_utc(row['created_at']))
            if row['qr_image']:
                self.media_files.add(row['qr_image'])
            self.counts['descargas'] += 1

    # ── Citas ───────────────────────────────────────────────────────────────

    def import_appointments(self):
        settings_row = self.rows('SELECT * FROM calendars_admincalendarsettings ORDER BY id LIMIT 1')
        if settings_row:
            cal = CalendarSettings.load()
            cal.google_calendar_id = settings_row[0]['google_calendar_id']
            cal.buffer_minutes = settings_row[0]['buffer_time']
            cal.save()

        used_orders = set()
        consultant = bookings.booking_team_member()
        for row in self.rows('SELECT * FROM calendars_appointment ORDER BY id'):
            product = Product.objects.filter(pk=row['product_id']).first()
            customer = self.user_map.get(row['customer_id'])
            order = None
            if row['order_item_id'] and row['order_item_id'] in self.item_map:
                candidate = self.item_map[row['order_item_id']].order
                if candidate.pk not in used_orders:
                    order = candidate
                    used_orders.add(candidate.pk)

            # En el sitio anterior una cita quedaba 'pending' hasta pagarse:
            # las que siguen así son reservas abandonadas y no deben ocupar
            # la agenda.
            status = row['status'] if row['status'] in dict(Appointment.STATUS_CHOICES) else 'pending'
            if status == 'pending':
                status = 'cancelled'
            appt = Appointment.objects.create(
                order=order, team_member=consultant, kind=bookings.kind(), source='web',
                title=product.name if product else '',
                customer_name=(customer.get_full_name() or customer.email) if customer else 'Sin cliente',
                customer_email=customer.email if customer else '',
                start_time=as_utc(row['start_time']),
                end_time=as_utc(row['end_time']),
                status=status,
                google_event_id=row['google_event_id'] or '',
            )
            Appointment.objects.filter(pk=appt.pk).update(created_at=as_utc(row['created_at']))
            AppointmentItem.objects.create(appointment=appt, product=product)
            if customer:
                bookings.link_client(appt, user=customer, tags=['Sitio anterior'],
                                     note='Importado del sitio anterior.')
                if order and order.status == 'completed' and order.total_amount > 0:
                    bookings.promote_client(appt, f'Pagó en el sitio anterior (pedido #{order.pk}).')
            self.counts['citas'] += 1

    # ── Cierre ──────────────────────────────────────────────────────────────

    def reset_sequences(self):
        """IDs explícitos: en Postgres la secuencia debe saltar al máximo importado."""
        sql = connection.ops.sequence_reset_sql(no_style(), [Category, Product, Order])
        with connection.cursor() as cursor:
            for statement in sql:
                cursor.execute(statement)

    def verify(self):
        src_orders = self.rows('SELECT COUNT(*) FROM store_order WHERE "paymentStatus" != ?', SKIPPED_STATUS)[0][0]
        src_products = self.rows('SELECT COUNT(*) FROM store_product')[0][0]
        src_appts = self.rows('SELECT COUNT(*) FROM calendars_appointment')[0][0]
        checks = [
            ('pedidos', src_orders, Order.objects.count()),
            ('productos', src_products, Product.objects.count()),
            ('citas', src_appts, Appointment.objects.count()),
        ]
        for label, expected, got in checks:
            if expected != got:
                raise CommandError(f'Conteo de {label} no coincide: origen {expected}, importado {got}.')
        for row in self.rows('SELECT id, user_id FROM store_order WHERE user_id IS NOT NULL AND "paymentStatus" != ?',
                             SKIPPED_STATUS):
            expected = self.user_map.get(row['user_id'])
            got = Order.objects.get(pk=row['id']).user
            if expected != got:
                raise CommandError(f"Pedido #{row['id']}: usuario no coincide.")

    def copy_media(self, media_root):
        dest_root = Path(settings.MEDIA_ROOT)
        for rel in sorted(self.media_files):
            src = media_root / rel
            if not src.exists():
                self.warnings.append(f'Archivo no encontrado en el origen: {rel}')
                continue
            dest = dest_root / self.media_dest.get(rel, rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            self.counts['archivos copiados'] += 1

    def check_media(self, media_root):
        for rel in sorted(self.media_files):
            if not (media_root / rel).exists():
                self.warnings.append(f'Archivo no encontrado en el origen: {rel}')

    def report(self, dry_run):
        title = 'SIMULACIÓN (no se guardó nada)' if dry_run else 'Importación completada'
        self.stdout.write(self.style.SUCCESS(f'\n{title}\n'))
        for key, value in sorted(self.counts.items()):
            self.stdout.write(f'  {key:<32} {value}')
        if self.warnings:
            self.stdout.write(self.style.WARNING(f'\nAvisos ({len(self.warnings)}):'))
            for w in self.warnings:
                self.stdout.write(f'  - {w}')
