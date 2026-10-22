"""
Importa una página de Gamma como secciones editables del CMS.

    python manage.py import_gamma libro.el-librito-del-oro https://….gamma.site/ --dry-run
    python manage.py import_gamma libro.el-librito-del-oro https://….gamma.site/

`prefijo` es la página del sitio: para la página propia de un producto,
`libro.<slug>` (ver frontend ProductPage). La estructura queda en
`<prefijo>.secciones` (JSON) y cada texto o imagen en su propio bloque
(`<prefijo>.<sección>.<campo>`, `<prefijo>.<sección>.<item>.<campo>`), que
Adela edita después en el sitio. Las imágenes se copian al sitio: la página
no depende de Gamma.
"""

import json
import secrets
from urllib.parse import urlparse

import requests
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import BaseCommand, CommandError
from django.db import transaction

from content.gamma import sections_of
from content.models import ContentBlock, key_validator

UA = {'User-Agent': 'Mozilla/5.0 (adelavalverde.info import_gamma)'}


def new_id(prefix, taken):
    while True:
        i = prefix + secrets.token_hex(2)
        if i not in taken:
            taken.add(i)
            return i


class Command(BaseCommand):
    help = 'Importa una página de Gamma como secciones editables (bloques del CMS).'

    def add_arguments(self, parser):
        parser.add_argument('prefijo', help='Página del sitio, ej. libro.el-librito-del-oro')
        parser.add_argument('url', help='Página publicada en Gamma (….gamma.site)')
        parser.add_argument('--dry-run', action='store_true', help='Solo muestra las secciones; no guarda nada.')
        parser.add_argument('--replace', action='store_true',
                            help='Si la página ya tiene secciones, borra sus bloques y vuelve a importar.')

    def handle(self, prefijo, url, dry_run, replace, **options):
        try:
            key_validator(f'{prefijo}.secciones')
        except ValidationError as e:
            raise CommandError(f'Prefijo no válido: {e.messages[0]}')

        res = requests.get(url, headers=UA, timeout=30)
        if res.status_code != 200:
            raise CommandError(f'Gamma respondió {res.status_code} para {url}')
        try:
            sections = sections_of(res.text)
        except ValueError as e:
            raise CommandError(str(e))
        if not sections:
            raise CommandError('La página no tiene cards.')

        self.show(sections)
        if dry_run:
            self.stdout.write(self.style.WARNING('--dry-run: no se guardó nada.'))
            return

        existing = ContentBlock.objects.filter(key__startswith=f'{prefijo}.')
        if existing.exists():
            if not replace:
                raise CommandError(f'{prefijo} ya tiene {existing.count()} bloques; usa --replace para reemplazarlos.')
            for block in existing:
                if block.image:
                    block.image.delete(save=False)
            existing.delete()

        # Primero las imágenes (red), luego todo lo demás en una transacción.
        images = {}
        for s in sections:
            if s['imagen'] and s['imagen']['src'] not in images:
                images[s['imagen']['src']] = self.download(s['imagen']['src'])

        taken, structure = set(), []
        with transaction.atomic():
            for s in sections:
                sid = new_id('s', taken)
                entry = {'id': sid, 'tipo': s['tipo']}
                for opt in ('lado', 'estilo'):
                    if opt in s:
                        entry[opt] = s[opt]
                for campo, text in s['campos'].items():
                    self.block(f'{prefijo}.{sid}.{campo}', text=text)
                if s['imagen']:
                    self.block(f'{prefijo}.{sid}.imagen', image=images[s['imagen']['src']], framing=s['imagen']['framing'])
                if s['tipo'] in ('recuadros', 'listas'):
                    entry['items'] = []
                    for item in s['items']:
                        iid = new_id('i', taken)
                        entry['items'].append(iid)
                        for campo in ('titulo', 'texto'):
                            if item[campo]:
                                self.block(f'{prefijo}.{sid}.{iid}.{campo}', text=item[campo])
                structure.append(entry)
            self.block(f'{prefijo}.secciones', text=json.dumps(structure, ensure_ascii=False))

        count = ContentBlock.objects.filter(key__startswith=f'{prefijo}.').count()
        self.stdout.write(self.style.SUCCESS(f'{len(sections)} secciones importadas en {prefijo} ({count} bloques).'))

    def block(self, key, text='', image=None, framing=None):
        key_validator(key)
        block = ContentBlock(key=key, text=text, framing=framing or {})
        if image:
            name, content, ctype = image
            block.image = SimpleUploadedFile(name, content, content_type=ctype)
        block.save()

    def download(self, src):
        res = requests.get(src, headers=UA, timeout=60)
        if res.status_code != 200:
            raise CommandError(f'No se pudo descargar {src} ({res.status_code})')
        name = urlparse(src).path.rsplit('/', 1)[-1][-80:] or 'imagen.jpg'
        self.stdout.write(f'  imagen: {name} ({len(res.content) // 1024} KB)')
        return name, res.content, res.headers.get('Content-Type', 'image/jpeg')

    def show(self, sections):
        for n, s in enumerate(sections, 1):
            extra = ' '.join(f'{k}={s[k]}' for k in ('lado', 'estilo') if k in s)
            self.stdout.write(f"{n:2}. {s['tipo']:<9} {s['campos'].get('titulo', '')[:60]}  {extra}")
            if s['imagen']:
                self.stdout.write(f"      imagen: …{s['imagen']['src'][-50:]}")
            for item in s['items']:
                self.stdout.write(f"      · {item['titulo'][:40] or item['texto'][:40]}")
