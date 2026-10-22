import time

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import RegexValidator
from django.db import models
from evz_core.utils import compress_if_image


# '<página>.<sección>[.<campo>...]' en minúsculas, ej. 'home.hero.title'.
key_validator = RegexValidator(
    r'^[a-z0-9_-]+(\.[a-z0-9_-]+)+$',
    "Formato: página.sección (minúsculas, números, '-' o '_').",
)


def block_image_path(instance, filename):
    ext = filename.split('.')[-1]
    # El final de la clave (sección.imagen) basta para reconocerla; entera
    # puede pasar de los 100 caracteres del campo.
    return f'content/{instance.key[-60:]}_{int(time.time())}.{ext}'


class ContentBlock(models.Model):
    """
    Texto o imagen editable de una página, identificado por una clave estable
    (ej. 'home.hero.title'). El texto por defecto vive en el frontend: un
    bloque solo existe aquí cuando Adela lo edita, y sin él la página sigue
    mostrando el texto original.
    """

    key = models.CharField(max_length=200, unique=True, validators=[key_validator])
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to=block_image_path, null=True, blank=True)
    # Encuadre de la imagen sin recortar el archivo: {'x': 0–100, 'y': 0–100, 'zoom': 1–4}.
    # x/y es el punto de la imagen que queda a la vista (object-position); vacío = centrada.
    framing = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )

    class Meta:
        ordering = ('key',)
        verbose_name = 'Bloque de contenido'
        verbose_name_plural = 'Bloques de contenido'

    def __str__(self):
        return self.key

    @property
    def page(self):
        return self.key.split('.', 1)[0]

    def save(self, *args, **kwargs):
        if self.image and isinstance(self.image.file, UploadedFile):
            self.image = compress_if_image(self.image, quality=85)
        super().save(*args, **kwargs)


class ContentRevision(models.Model):
    """
    Copia del bloque antes de cada cambio. Permite deshacer una edición
    accidental desde el admin sin depender de backups.
    """

    block = models.ForeignKey(ContentBlock, on_delete=models.CASCADE, related_name='revisions')
    text = models.TextField(blank=True)
    image = models.CharField(max_length=255, blank=True)
    framing = models.JSONField(default=dict, blank=True)
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'Revisión'
        verbose_name_plural = 'Revisiones'

    def __str__(self):
        return f"{self.block.key} · {self.created_at:%Y-%m-%d %H:%M}"
