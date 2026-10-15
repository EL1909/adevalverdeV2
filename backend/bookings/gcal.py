"""
Escritura en el Google Calendar de Adela.

evz_calendars solo consulta la disponibilidad (freebusy, scope de lectura).
El sitio anterior además creaba un evento por cita pagada; esto lo porta.
Sin GOOGLE_SERVICE_ACCOUNT_FILE o sin calendario configurado no hace nada:
la cita existe igual en la base y en el admin.
"""

import logging

from django.conf import settings
from evz_calendars.models import CalendarSettings

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/calendar.events']


def _service():
    account_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE
    calendar_id = CalendarSettings.load().google_calendar_id
    if not account_file or not calendar_id:
        return None, None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        creds = service_account.Credentials.from_service_account_file(account_file, scopes=SCOPES)
        return build('calendar', 'v3', credentials=creds, cache_discovery=False), calendar_id
    except Exception:
        logger.exception('Google Calendar: no se pudo abrir la cuenta de servicio')
        return None, None


def event_body(appointment):
    services = ', '.join(appointment.service_names) or 'Asesoría'
    lines = [
        f'Cliente: {appointment.customer_name}',
        f'Email: {appointment.customer_email}',
    ]
    if appointment.customer_phone:
        lines.append(f'Teléfono: {appointment.customer_phone}')
    if appointment.order_id:
        lines.append(f'Pedido #{appointment.order_id}')
    for note in appointment.notes or []:
        lines.append(f"Nota: {note.get('text', '')}")
    return {
        'summary': f'{services} · {appointment.customer_name}',
        'description': '\n'.join(lines),
        # Se guarda en UTC; Google lo muestra en la zona del calendario.
        'start': {'dateTime': appointment.start_time.isoformat(), 'timeZone': 'UTC'},
        'end': {'dateTime': appointment.end_time.isoformat(), 'timeZone': 'UTC'},
    }


def create_event(appointment):
    """Crea el evento y devuelve su ID, o '' si no hay calendario o falla."""
    service, calendar_id = _service()
    if not service:
        return ''
    try:
        event = service.events().insert(calendarId=calendar_id, body=event_body(appointment)).execute()
        return event.get('id', '')
    except Exception:
        logger.exception('Google Calendar: no se pudo crear el evento de la cita %s', appointment.pk)
        return ''


def delete_event(event_id):
    service, calendar_id = _service()
    if not service or not event_id:
        return False
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception:
        logger.exception('Google Calendar: no se pudo borrar el evento %s', event_id)
        return False
