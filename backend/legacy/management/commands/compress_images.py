"""
Comprime las imágenes que ya están en media con el mismo método que las
subidas nuevas (evz_core.utils.compress_image: máx. 1920 px, JPEG 85).

Las subidas desde el admin ya se comprimen al guardarse; esto es para las
que llegaron sin pasar por ahí (importación del sitio anterior). No toca los
archivos descargables: son el producto que se vende.

    ./venv/bin/python manage.py compress_images --dry-run
    ./venv/bin/python manage.py compress_images
"""

from django.core.management import BaseCommand
from evz_core.utils import compress_image, is_image_upload
from evz_store.models import Product

from accounts.models import Profile
from content.models import ContentBlock

FIELDS = [(Product, 'image'), (ContentBlock, 'image'), (Profile, 'profile_picture')]
ALREADY_SMALL = 400 * 1024  # un JPEG por debajo de esto ya pasó por compress_image


class Command(BaseCommand):
    help = 'Comprime las imágenes existentes en media (portadas, bloques, perfiles).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Solo informa, no cambia nada.')

    def handle(self, *args, **opts):
        before = after = done = 0
        for model, field in FIELDS:
            for obj in model.objects.exclude(**{field: ''}).exclude(**{f'{field}__isnull': True}):
                file = getattr(obj, field)
                if not is_image_upload(file) or not file.storage.exists(file.name):
                    continue
                size = file.size
                if file.name.lower().endswith(('.jpg', '.jpeg')) and size < ALREADY_SMALL:
                    continue
                with file.open('rb'):
                    compressed = compress_image(file)
                if compressed is file or compressed.size >= size:
                    continue
                before += size
                after += compressed.size
                done += 1
                self.stdout.write(f'{file.name}: {size // 1024} KB → {compressed.size // 1024} KB')
                if opts['dry_run']:
                    continue
                old = file.name
                new = file.storage.save(file.field.generate_filename(obj, compressed.name), compressed)
                # update() y no save(): sin señales ni una segunda compresión.
                model.objects.filter(pk=obj.pk).update(**{field: new})
                file.storage.delete(old)

        verb = 'Se comprimirían' if opts['dry_run'] else 'Comprimidas'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {done} imágenes: {before / 2**20:.1f} MB → {after / 2**20:.1f} MB'
        ))
