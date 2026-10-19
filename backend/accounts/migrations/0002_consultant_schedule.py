"""
Agenda de Adela: un único miembro del equipo, horario de lunes a viernes
(9–19, editable en el admin) y las citas sin asignar pasan a su agenda.

Venía de la app bookings (reemplazada por evz_calendars.booking en v1.5.0).
Es idempotente: en una base donde ya corrió, no cambia nada.
"""

from datetime import time

from django.db import migrations


def forwards(apps, schema_editor):
    TeamMember = apps.get_model('evz_core', 'TeamMember')
    WeeklySchedule = apps.get_model('evz_calendars', 'WeeklySchedule')
    Appointment = apps.get_model('evz_calendars', 'Appointment')

    tm = TeamMember.objects.filter(is_active=True).order_by('pk').first()
    if tm is None:
        tm = TeamMember.objects.create(display_name='Adela Valverde')
    if not WeeklySchedule.objects.filter(team_member=tm).exists():
        for weekday in range(7):
            WeeklySchedule.objects.create(
                team_member=tm, weekday=weekday, is_open=weekday < 5,
                opens_at=time(9, 0), closes_at=time(19, 0),
            )
    Appointment.objects.filter(team_member__isnull=True).update(team_member=tm)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
        ('evz_core', '0012_teammember_email'),
        ('evz_calendars', '0007_appointmentphoto'),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
