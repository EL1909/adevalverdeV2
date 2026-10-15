from django.core.exceptions import ValidationError
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ContentBlock, ContentRevision, key_validator
from .serializers import ContentBlockSerializer


class ContentListView(APIView):
    """
    GET /api/content/?page=home → { "home.hero.title": {text, image, ...}, ... }
    Público: el frontend mezcla estos bloques con sus textos por defecto.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        blocks = ContentBlock.objects.all()
        page = request.query_params.get('page')
        if page:
            blocks = blocks.filter(key__startswith=f'{page}.')
        data = ContentBlockSerializer(blocks, many=True, context={'request': request}).data
        return Response({b['key']: b for b in data})


class ContentBlockView(APIView):
    """
    PUT /api/content/<key>/ — crea o actualiza un bloque (solo staff).
    Guarda una revisión con el valor anterior antes de sobrescribir.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def put(self, request, key):
        try:
            key_validator(key)
        except ValidationError as e:
            return Response({'key': e.messages}, status=status.HTTP_400_BAD_REQUEST)
        block, created = ContentBlock.objects.get_or_create(key=key)
        if not created:
            ContentRevision.objects.create(
                block=block, text=block.text,
                image=block.image.name if block.image else '',
                edited_by=block.updated_by,
            )
        serializer = ContentBlockSerializer(
            block, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
