"""
Mantiene el Google Calendar de Adela al día cuando se cancela o borra una
cita (también desde el admin), y engancha las reservas al cobro.
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from evz_calendars.models import Appointment
from evz_payments.signals import before_charge
from evz_store.signals import order_cancelled, order_paid

from . import gcal, services


@receiver(post_save, sender=Appointment)
def remove_cancelled_event(sender, instance, **kwargs):
    if instance.status == 'cancelled' and instance.google_event_id:
        gcal.delete_event(instance.google_event_id)
        # También en la instancia: un save() posterior no debe restaurar el ID.
        instance.google_event_id = ''
        Appointment.objects.filter(pk=instance.pk).update(google_event_id='')


@receiver(post_delete, sender=Appointment)
def remove_deleted_event(sender, instance, **kwargs):
    if instance.google_event_id:
        gcal.delete_event(instance.google_event_id)


# ── Cobro (evz_payments / evz_store) ────────────────────────────────────────

@receiver(before_charge)
def check_slot_before_charge(sender, order, **kwargs):
    # CheckoutError si la cita perdió su horario: no se cobra.
    services.ensure_bookable(order)


@receiver(order_paid)
def confirm_booking_when_paid(sender, order, **kwargs):
    # True: el correo de la cita sustituye al de pedido.
    return services.confirm_for_order(order)


@receiver(order_cancelled)
def cancel_booking_with_order(sender, order, reason='', **kwargs):
    appt = services.appointment_of(order)
    if appt and appt.status != 'cancelled':
        services.cancel_booking(appt, f'Cancelada: {reason}' if reason else 'Cancelada con su pedido.')
