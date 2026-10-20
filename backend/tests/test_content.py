"""CMS (app content): encuadre de imágenes editable por el staff."""

import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
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
