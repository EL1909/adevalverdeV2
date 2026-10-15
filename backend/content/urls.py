from django.urls import path
from .views import ContentBlockView, ContentListView

urlpatterns = [
    path('', ContentListView.as_view(), name='content-list'),
    path('<str:key>/', ContentBlockView.as_view(), name='content-block'),
]
