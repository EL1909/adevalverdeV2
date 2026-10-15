"""
Reserva de asesorías: horario libre → cita retenida → pago → confirmación.

La disponibilidad, el horario semanal y los bloqueos son los de
evz_calendars. Lo propio de Adela vive aquí:

- una sola agenda (la suya), así que no se elige con quién reservar;
- la cita se crea junto con su pedido y retiene el horario
  BOOKING_HOLD_MINUTES mientras se paga; si no se paga, se libera;
- solo al cobrarse (o si es gratuita) se confirma, se crea el evento en
  Google Calendar y se envía el correo;
- las sesiones gratuitas (ej. "Primera Cita") se reservan una vez por email.

El cobro es de evz_payments; esta app se entera por señales (signals.py):
before_charge → ensure_bookable, order_paid → confirm_for_order,
order_cancelled → cancel_booking.
"""

import datetime
import logging

from django.db import models
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from evz_calendars.availability import available_slots, business_tz, day_window, is_slot_free, slot_minutes_for
from evz_calendars.models import Appointment, AppointmentItem
from evz_core.models import TeamMember
from evz_core.mail_relay import send_relay_email
from evz_core.notifications import notify_superusers
from evz_payments.services import MANUAL_PREFIX, CheckoutError, cents
from evz_store.models import Order, OrderItem, Product
from evz_store.services import frontend_url, receipt_token, receipt_url

from . import gcal

logger = logging.getLogger(__name__)

ACTIVE = ('pending', 'confirmed')
KIND = 'asesoria'


def consultant():
    """La agenda que se reserva: el primer miembro activo del equipo (Adela)."""
    tm = TeamMember.objects.filter(is_active=True).order_by('pk').first()
    if tm is None:
        tm = TeamMember.objects.create(display_name='Adela Valverde')
    return tm


def service_products():
    """Asesorías: productos activos con duración que no son planes."""
    return (Product.objects.filter(is_active=True, plan__isnull=True)
            .exclude(duration='').select_related('category').order_by('price', 'name'))


def get_service(product_id):
    try:
        return service_products().get(pk=int(product_id))
    except (Product.DoesNotExist, TypeError, ValueError):
        return None


# ── Retenciones vencidas ───────────────────────────────────────────────────

def release_expired_holds():
    """
    Cancela las citas cuyo pago no llegó a tiempo y libera su horario. Con
    pago manual (Zelle, transferencia, USDT) el plazo es mayor: Adela tiene
    que verlo en su cuenta.
    """
    now = timezone.now()
    online = now - datetime.timedelta(minutes=settings.BOOKING_HOLD_MINUTES)
    manual = now - datetime.timedelta(hours=settings.MANUAL_PAYMENT_HOLD_HOURS)
    expired = Appointment.objects.filter(
        status='pending', kind=KIND, order__status='pending',
    ).filter(
        models.Q(created_at__lt=manual)
        | (models.Q(created_at__lt=online) & ~models.Q(order__payment_method__startswith=MANUAL_PREFIX))
    ).select_related('order')
    for appt in expired:
        with transaction.atomic():
            appt.status = 'cancelled'
            appt.save(update_fields=['status'])
            appt.add_system_note('Cancelada: el pago no se completó a tiempo.')
            appt.order.status = 'cancelled'
            appt.order.save(update_fields=['status'])


# ── Disponibilidad ──────────────────────────────────────────────────────────

def booking_window():
    """Primer y último instante reservables."""
    now = timezone.now()
    first = now + datetime.timedelta(hours=settings.BOOKING_MIN_NOTICE_HOURS)
    last = now + datetime.timedelta(days=settings.BOOKING_HORIZON_DAYS)
    return first, last


def open_days(product):
    """
    Días con horario de atención dentro del plazo de reserva. Solo mira el
    horario semanal (sin Google Calendar, que se consulta al abrir el día);
    sirve para pintar el calendario sin una consulta por día.
    """
    first, last = booking_window()
    tm = consultant()
    tz = business_tz()
    day = first.astimezone(tz).date()
    end = last.astimezone(tz).date()
    days = []
    while day <= end:
        opens, closes = day_window(day, tm)
        if opens is not None and closes > first:
            days.append(day.isoformat())
        day += datetime.timedelta(days=1)
    return days


def day_slots(product, date):
    """Horarios libres de ese día para esa asesoría, ya filtrados por plazo."""
    release_expired_holds()
    first, last = booking_window()
    result = available_slots(date, consultant(), [product])
    result['slots'] = [
        s for s in result['slots']
        if first <= datetime.datetime.fromisoformat(s['start']) <= last
    ]
    return result


# ── Reserva ─────────────────────────────────────────────────────────────────

def parse_start(value):
    try:
        start = datetime.datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None
    if timezone.is_naive(start):
        start = start.replace(tzinfo=business_tz())
    return start


@transaction.atomic
def create_booking(*, product, start, user, customer_name, customer_email, customer_phone='', message=''):
    """
    Crea cita y pedido pendientes. El horario se revalida contra la
    disponibilidad real (la que vio el navegador pudo quedar obsoleta).
    """
    email = (user.email if user else customer_email or '').strip()
    if not email:
        raise CheckoutError('Necesitamos un email para enviarte la confirmación.')
    name = (customer_name or (user.get_full_name() if user else '') or email).strip()

    # Bloqueo de la agenda: dos reservas simultáneas se atienden una tras otra.
    tm = TeamMember.objects.select_for_update().get(pk=consultant().pk)
    tz = business_tz()
    local = start.astimezone(tz)
    free = {s['start'] for s in day_slots(product, local.date())['slots']}
    if local.isoformat() not in free:
        raise CheckoutError('Ese horario ya no está disponible. Elige otro, por favor.')

    if product.price == 0 and Appointment.objects.filter(
        items__product=product, customer_email__iexact=email, status__in=('pending', 'confirmed', 'completed'),
    ).exists():
        raise CheckoutError(f'«{product.name}» ya está reservada con este email.')

    end = start + datetime.timedelta(minutes=slot_minutes_for([product]))
    order = Order.objects.create(
        customer_name=name, customer_email=email, customer_phone=customer_phone or '',
        user=user, status='pending',
        booking_date=local.date(), booking_time=local.time(), team_member=tm,
    )
    OrderItem.objects.create(order=order, product=product, description=product.name,
                             quantity=1, unit_price=product.price)
    appt = Appointment.objects.create(
        order=order, team_member=tm, kind=KIND, title=product.name,
        customer_name=name, customer_email=email, customer_phone=customer_phone or '',
        start_time=start, end_time=end, status='pending',
    )
    AppointmentItem.objects.create(appointment=appt, product=product)
    if message.strip():
        appt.add_system_note(f'Mensaje de {name}: {message.strip()}')
    return appt


def appointment_of(order):
    return Appointment.objects.filter(order=order).first()


def ensure_bookable(order):
    """
    Antes de cobrar: si la retención venció y el horario sigue libre, la
    cita se reactiva; si alguien lo tomó, no se cobra.
    """
    appt = appointment_of(order)
    if not appt or appt.status != 'cancelled' or order.status == 'completed':
        return
    free, _ = is_slot_free(appt.start_time, appt.end_time, appt.team_member, exclude_appointment_id=appt.pk)
    if not free:
        raise CheckoutError('El tiempo para pagar venció y ese horario ya se reservó. Elige otro, por favor.')
    appt.status = 'pending'
    appt.save(update_fields=['status'])
    appt.add_system_note('Reactivada: el pago llegó después de vencer la retención.')
    order.status = 'pending'
    order.save(update_fields=['status'])


def receipt_extra(order):
    """Lo que el recibo (evz_payments) añade de esta app: la cita del pedido."""
    appt = appointment_of(order)
    return {'booking': booking_payload(appt) if appt else None}


def confirm_for_order(order):
    """
    Al pagarse un pedido (señal order_paid). Devuelve True si era una
    reserva: su correo sustituye al de pedido.
    """
    appt = appointment_of(order)
    if not appt:
        return False
    if appt.status == 'confirmed':
        return True
    if appt.status == 'cancelled':
        # Cobrado por PayPal después de vencer la retención (webhook).
        free, _ = is_slot_free(appt.start_time, appt.end_time, appt.team_member, exclude_appointment_id=appt.pk)
        if not free:
            note = 'Pagada después de vencer la retención y el horario ya estaba tomado: reprogramar o devolver.'
            appt.add_system_note(note)
            order.add_system_note(note)
            transaction.on_commit(lambda: notify_superusers(
                notif_type='APPOINTMENT_CONFLICT', title='Asesoría pagada sin horario',
                body=f'{appt.customer_name} · pedido #{order.pk}',
                link=f'/admin/evz_calendars/appointment/{appt.pk}/change/', content_object=appt,
            ))
            return False  # recibe el correo de pedido; Adela le escribe para reprogramar
    appt.status = 'confirmed'
    appt.save(update_fields=['status'])
    if not appt.google_event_id:
        appt.google_event_id = gcal.create_event(appt)
        appt.save(update_fields=['google_event_id'])
    transaction.on_commit(lambda: after_confirm(appt.pk))
    return True


def after_confirm(appointment_id):
    appt = Appointment.objects.select_related('order').get(pk=appointment_id)
    send_booking_email(appt)
    notify_superusers(
        notif_type='NEW_APPOINTMENT', title='Nueva asesoría reservada',
        body=f'{appt.customer_name} · {local_label(appt)}',
        link=f'/admin/evz_calendars/appointment/{appt.pk}/change/',
        content_object=appt, data={'appointment_id': appt.pk},
    )


def cancel_booking(appt, reason):
    """Cancela la cita (el evento de Google se borra en signals)."""
    appt.status = 'cancelled'
    appt.save(update_fields=['status'])
    appt.add_system_note(reason)
    order = appt.order
    if order and order.total_amount == 0 and order.status != 'cancelled':
        order.status = 'cancelled'
        order.save(update_fields=['status'])
    return appt


def can_customer_cancel(appt):
    """El cliente cancela solo sesiones gratuitas y con la antelación mínima."""
    first, _ = booking_window()
    return (
        appt.status in ACTIVE and appt.start_time >= first
        and (appt.order is None or appt.order.total_amount == 0)
    )


# ── Presentación y correo ───────────────────────────────────────────────────

def local_label(appt):
    start = appt.start_time.astimezone(business_tz())
    return f'{start:%d/%m/%Y %H:%M} (hora de Madrid)'


def booking_payload(appt):
    order = appt.order
    return {
        'id': appt.pk,
        'service': ', '.join(appt.service_names) or appt.title,
        'start': appt.start_time.isoformat(),
        'end': appt.end_time.isoformat(),
        'timezone': settings.TIME_ZONE,
        'status': appt.status,
        'customer_name': appt.customer_name,
        'paid': bool(order and order.status == 'completed'),
        'total': cents(order.total_amount) if order else '0.00',
        'receipt': receipt_token(order) if order else None,
        'can_cancel': can_customer_cancel(appt),
    }


def ics(appt):
    fmt = '%Y%m%dT%H%M%SZ'
    utc = datetime.timezone.utc
    service = ', '.join(appt.service_names) or 'Asesoría'
    return '\r\n'.join([
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adela Valverde//Asesorias//ES', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        f'UID:asesoria-{appt.pk}@adelavalverde.info',
        f'DTSTAMP:{timezone.now().astimezone(utc):{fmt}}',
        f'DTSTART:{appt.start_time.astimezone(utc):{fmt}}',
        f'DTEND:{appt.end_time.astimezone(utc):{fmt}}',
        f'SUMMARY:{service} con Adela Valverde',
        'END:VEVENT', 'END:VCALENDAR', '',
    ])


def send_booking_email(appt):
    if not appt.customer_email:
        return False
    service = ', '.join(appt.service_names) or appt.title
    lines = [
        f'Hola {appt.customer_name},', '',
        'Tu asesoría está confirmada.', '',
        service, local_label(appt), '',
        'Adjuntamos el evento para tu calendario. Antes de la sesión recibirás los datos para conectarte.',
        '', f"Tus asesorías: {frontend_url('/cuenta')}",
        '', 'Si necesitas cambiar la fecha, responde a este correo.',
    ]
    return send_relay_email(
        to=appt.customer_email,
        subject=f"Tu asesoría del {appt.start_time.astimezone(business_tz()):%d/%m}",
        headline='Asesoría confirmada',
        body_text='\n'.join(lines),
        button_text='Ver mi reserva' if appt.order else '',
        button_url=receipt_url(appt.order) if appt.order else '',
        attachments=[{'filename': 'asesoria.ics', 'content': ics(appt), 'mimetype': 'text/calendar'}],
        email_type='appointment_confirmation',
    )
