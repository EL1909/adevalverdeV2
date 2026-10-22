"""CMS (app content): encuadre de imágenes editable por el staff e importación de Gamma."""

import io
import json
import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from content.gamma import sections_of
from content.models import ContentBlock

MEDIA = tempfile.mkdtemp()


def png(name='foto.png'):
    buf = io.BytesIO()
    Image.new('RGB', (40, 30), 'gold').save(buf, 'PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


@override_settings(MEDIA_ROOT=MEDIA)
class ImageFramingTests(TestCase):
    URL = '/api/content/test.portada.imagen/'

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.staff = User.objects.create_user(email='adela@example.org', password='x', is_staff=True)

    def test_only_staff_frames_and_values_are_checked(self):
        frame = {'framing': {'x': 30, 'y': 70.5, 'zoom': 1.8}}
        self.assertIn(self.api.put(self.URL, frame, format='json').status_code, (401, 403))
        self.api.force_authenticate(self.staff)
        res = self.api.put(self.URL, frame, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['framing'], {'x': 30.0, 'y': 70.5, 'zoom': 1.8})
        for bad in ({'x': 120, 'y': 0, 'zoom': 1}, {'x': 50, 'y': 50, 'zoom': 9}, {'x': 'a', 'y': 1, 'zoom': 1}, {'x': 1}):
            self.assertEqual(self.api.put(self.URL, {'framing': bad}, format='json').status_code, 400, bad)
        # Restablecer: vacío = imagen centrada.
        self.assertEqual(self.api.put(self.URL, {'framing': {}}, format='json').data['framing'], {})

    def test_revision_keeps_previous_framing_and_new_image_resets_it(self):
        self.api.force_authenticate(self.staff)
        self.api.put(self.URL, {'image': png()}, format='multipart')
        self.api.put(self.URL, {'framing': {'x': 10, 'y': 20, 'zoom': 2}}, format='json')
        res = self.api.put(self.URL, {'image': png('otra.png')}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        block = ContentBlock.objects.get(key='test.portada.imagen')
        self.assertEqual(block.framing, {})
        self.assertEqual(block.revisions.first().framing, {'x': 10.0, 'y': 20.0, 'zoom': 2.0})

    def test_image_can_be_removed(self):
        self.api.force_authenticate(self.staff)
        self.api.put(self.URL, {'image': png()}, format='multipart')
        res = self.api.put(self.URL, {'image': None}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.data['image'])
        self.assertTrue(ContentBlock.objects.get(key='test.portada.imagen').revisions.first().image)


def text(s, *marks):
    return {'type': 'text', 'text': s, 'marks': [{'type': m} for m in marks]}


def node(type_, *content, **attrs):
    return {'type': type_, 'attrs': attrs, 'content': list(content)}


def gamma_page(*cards):
    data = {'props': {'pageProps': {'doc': {'content': list(cards)}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'


CHECK = {'type': 'emoji', 'attrs': {'native': '✔️'}}
BR = {'type': 'hardBreak'}
ACCENT = node('cardAccentLayoutItem', background={'type': 'image', 'image': {
    'src': 'https://cdn.gamma.app/x/portada.png', 'backgroundPos': {'x': 40, 'y': 10}}})

PAGE = gamma_page(
    node('card', ACCENT, node('cardLayoutItem',
         node('heading', text('Despierta'), level=1),
         node('paragraph', text('Hoy '), text('empieza', 'bold'), text('.')),
         node('buttonGroup', node('button', text('QUIERO EMPEZAR'), href='https://pay.hotmart.com/X')),
         node('paragraph', text('Acceso inmediato'))), layout='right'),
    node('card', node('cardLayoutItem',
         node('heading', text('Beneficios'), level=2),
         node('paragraph', CHECK, text(' Paz'), BR, CHECK, text(' Fe')))),
    node('card', node('cardLayoutItem',
         node('heading', text('Testimonios'), level=2),
         node('smartLayout',
              node('smartLayoutCell', node('heading', text('Ana'), level=4), node('paragraph', text('"Me cambió"'))),
              node('smartLayoutCell', node('heading', text('Eva'), level=4), node('paragraph', text('"Gracias"'))),
              variantKey='steps'),
         node('paragraph', text('Únete')))),
    node('card', node('cardLayoutItem', node('heading', text('Oculta'))), hidden=True),
    node('card', node('cardLayoutItem',
         node('heading', text('Oferta'), level=1),
         node('paragraph', text('Antes '), text('$97', 'strike'), text(' ahora $55')),
         node('calloutBox', node('paragraph', text('Menos de $14 la hora'))),
         node('buttonGroup', node('button', text('COMPRAR'))))),
)


class GammaParserTests(TestCase):
    def test_cards_become_typed_sections(self):
        portada, lista, recuadros, oferta = sections_of(PAGE)  # la card oculta no cuenta

        self.assertEqual(portada['tipo'], 'portada')
        self.assertEqual(portada['campos'], {
            'titulo': 'Despierta', 'texto': 'Hoy **empieza**.', 'nota': 'Acceso inmediato', 'boton': 'QUIERO EMPEZAR'})
        self.assertEqual(portada['lado'], 'derecha')
        self.assertEqual(portada['imagen'], {'src': 'https://cdn.gamma.app/x/portada.png',
                                             'framing': {'x': 40, 'y': 10, 'zoom': 1}})

        # Un párrafo de líneas con emoji es una lista.
        self.assertEqual(lista['tipo'], 'listas')
        self.assertEqual(lista['items'], [{'titulo': '', 'texto': '- Paz\n- Fe'}])

        self.assertEqual(recuadros['tipo'], 'recuadros')
        self.assertEqual(recuadros['estilo'], 'testimonios')
        self.assertEqual([i['titulo'] for i in recuadros['items']], ['Ana', 'Eva'])
        self.assertEqual(recuadros['campos']['cierre'], 'Únete')

        self.assertEqual(oferta['tipo'], 'oferta')
        self.assertEqual(oferta['campos']['texto'], 'Antes ~~$97~~ ahora $55')
        self.assertEqual(oferta['campos']['destacado'], 'Menos de $14 la hora')
        self.assertIsNone(oferta['imagen'])

    def test_not_a_gamma_page(self):
        with self.assertRaises(ValueError):
            sections_of('<html></html>')


def fake_get(url, **kwargs):
    res = mock.Mock(status_code=200, headers={'Content-Type': 'image/png'})
    if url.endswith('.png'):
        res.content = png().read()
    else:
        res.text = PAGE
    return res


@override_settings(MEDIA_ROOT=MEDIA)
class ImportGammaTests(TestCase):
    PREFIX = 'libro.un-libro-con-un-nombre-bastante-largo-para-probar-que-las-claves-de-los-bloques-caben-sin-problema'

    def run_import(self, *args):
        out = io.StringIO()
        with mock.patch('content.management.commands.import_gamma.requests.get', side_effect=fake_get):
            call_command('import_gamma', self.PREFIX, 'https://x.gamma.site/', *args, stdout=out)
        return out.getvalue()

    def test_import_creates_structure_fields_and_images(self):
        self.run_import()
        blocks = {b.key: b for b in ContentBlock.objects.filter(key__startswith=f'{self.PREFIX}.')}
        structure = json.loads(blocks[f'{self.PREFIX}.secciones'].text)
        self.assertEqual([s['tipo'] for s in structure], ['portada', 'listas', 'recuadros', 'oferta'])

        portada, lista, recuadros, _ = structure
        self.assertEqual(blocks[f"{self.PREFIX}.{portada['id']}.boton"].text, 'QUIERO EMPEZAR')
        image = blocks[f"{self.PREFIX}.{portada['id']}.imagen"]
        self.assertTrue(image.image.name.startswith('content/'))
        self.assertEqual(image.framing, {'x': 40, 'y': 10, 'zoom': 1})
        self.assertEqual(recuadros['estilo'], 'testimonios')
        first = recuadros['items'][0]
        self.assertEqual(blocks[f"{self.PREFIX}.{recuadros['id']}.{first}.titulo"].text, 'Ana')
        self.assertEqual(blocks[f"{self.PREFIX}.{lista['id']}.{lista['items'][0]}.texto"].text, '- Paz\n- Fe')
        self.assertGreater(max(len(k) for k in blocks), 120)  # claves largas: max_length 200

    def test_dry_run_saves_nothing_and_existing_page_needs_replace(self):
        self.run_import('--dry-run')
        self.assertFalse(ContentBlock.objects.exists())
        self.run_import()
        before = ContentBlock.objects.count()
        with self.assertRaises(CommandError):
            self.run_import()
        self.run_import('--replace')
        self.assertEqual(ContentBlock.objects.count(), before)
