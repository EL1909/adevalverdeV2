"""
Agenda para el panel de Adela (/cuenta → Calendario): las API de staff de
evz_calendars. No se monta evz_calendars.urls entero porque su POST de citas
es público y crearía reservas sin pasar por el pago.
"""

from django.urls import include, path
from evz_calendars.views import (
    AppointmentDetailView, AppointmentListCreateView, AppointmentMessageView,
    TimeBlockViewSet, WeeklyScheduleViewSet,
)
from rest_framework.routers import DefaultRouter


class StaffAppointmentListView(AppointmentListCreateView):
    """Solo GET (staff): citas y bloqueos en formato FullCalendar."""
    http_method_names = ['get', 'head', 'options']


router = DefaultRouter()
router.register('schedule', WeeklyScheduleViewSet, basename='weekly-schedule')
router.register('blocks', TimeBlockViewSet, basename='time-block')

urlpatterns = [
    path('appointments/', StaffAppointmentListView.as_view()),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view()),
    path('appointments/<int:pk>/message/', AppointmentMessageView.as_view()),
    path('', include(router.urls)),
]
