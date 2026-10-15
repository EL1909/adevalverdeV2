from django.apps import AppConfig


class LegacyConfig(AppConfig):
    """Importación única desde el sitio anterior. Se retira tras el corte."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'legacy'
