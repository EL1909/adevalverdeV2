from django.urls import path

from . import views

urlpatterns = [
    path('', views.BookingCreateView.as_view()),
    path('services/', views.ServiceListView.as_view()),
    path('days/', views.DaysView.as_view()),
    path('slots/', views.SlotsView.as_view()),
    path('mine/', views.MyBookingsView.as_view()),
    path('<int:pk>/cancel/', views.BookingCancelView.as_view()),
]
