from rest_framework import serializers
from .models import ContentBlock


class ContentBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = ['key', 'text', 'image', 'framing', 'updated_at']
        read_only_fields = ['key', 'updated_at']

    def validate_framing(self, value):
        if value in (None, {}):
            return {}
        if not isinstance(value, dict) or set(value) != {'x', 'y', 'zoom'}:
            raise serializers.ValidationError('El encuadre lleva x, y y zoom.')
        try:
            x, y, zoom = (float(value[k]) for k in ('x', 'y', 'zoom'))
        except (TypeError, ValueError):
            raise serializers.ValidationError('El encuadre debe ser numérico.')
        if not (0 <= x <= 100 and 0 <= y <= 100 and 1 <= zoom <= 4):
            raise serializers.ValidationError('Encuadre fuera de rango (x e y entre 0 y 100, zoom entre 1 y 4).')
        return {'x': round(x, 2), 'y': round(y, 2), 'zoom': round(zoom, 3)}
