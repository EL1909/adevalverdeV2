"""Genera el par de claves VAPID para Web Push (copiar a backend/.env)."""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management import BaseCommand


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


class Command(BaseCommand):
    help = 'Genera VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (formato raw base64url).'

    def handle(self, *args, **options):
        key = ec.generate_private_key(ec.SECP256R1())
        private = key.private_numbers().private_value.to_bytes(32, 'big')
        public = key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
        )
        self.stdout.write(f'VAPID_PUBLIC_KEY={b64url(public)}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={b64url(private)}')
