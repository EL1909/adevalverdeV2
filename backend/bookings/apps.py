from django.apps import AppConfig


class BookingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bookings'
    verbose_name = 'Reservas de asesoría'

    def ready(self):
        from . import signals  # noqa: F401
