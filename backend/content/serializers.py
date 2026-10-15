from rest_framework import serializers
from .models import ContentBlock


class ContentBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = ['key', 'text', 'image', 'updated_at']
        read_only_fields = ['key', 'updated_at']
