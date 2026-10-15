from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Prefijo de ruta. Vacío en adelavalverde.info; se configura en .env.
P = settings.URL_PREFIX

urlpatterns = [
    path(f'{P}admin/', admin.site.urls),
    path(f'{P}api/business/', include('evz_core.urls')),
    path(f'{P}api/accounts/', include('accounts.urls')),
    path(f'{P}api/content/', include('content.urls')),
    # Tienda: catálogo, descargas, planes y, para el staff, la gestión de
    # productos y pedidos. Crear pedidos sin pasar por evz_payments está
    # desactivado (EVZ_STORE_PUBLIC_ORDER_CREATE = False).
    path(f'{P}api/store/', include('evz_store.urls')),
    path(f'{P}api/payments/', include('evz_payments.urls')),
    path(f'{P}api/bookings/', include('bookings.urls')),
    # Agenda de Adela (solo staff): citas, horario semanal y bloqueos.
    path(f'{P}api/calendars/', include('bookings.staff_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
