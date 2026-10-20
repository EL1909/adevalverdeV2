from django.contrib import admin
from .models import ContentBlock, ContentRevision


class ContentRevisionInline(admin.TabularInline):
    model = ContentRevision
    extra = 0
    can_delete = False
    readonly_fields = ('text', 'image', 'framing', 'edited_by', 'created_at')


@admin.register(ContentBlock)
class ContentBlockAdmin(admin.ModelAdmin):
    list_display = ('key', 'page', 'updated_at', 'updated_by')
    search_fields = ('key', 'text')
    readonly_fields = ('updated_at', 'updated_by')
    inlines = [ContentRevisionInline]
