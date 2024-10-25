from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServerViewSet, PresetViewSet, ConfigurationViewSet, BuildDetailView, LinterCheckDetailView, TestRunDetailView

router = DefaultRouter()
router.register(r'servers', ServerViewSet)
router.register(r'presets', PresetViewSet)
router.register(r'configs', ConfigurationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('builds/<int:pk>/', BuildDetailView.as_view(), name='build-detail'),
    path('checks/<int:pk>/', LinterCheckDetailView.as_view(), name='lintercheck-detail'),
    path('tests/<int:pk>/', TestRunDetailView.as_view(), name='testrun-detail'),
]
