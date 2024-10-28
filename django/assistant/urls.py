from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import ServerViewSet, PresetViewSet, ConfigurationViewSet, ThreadViewSet

router = DefaultRouter()
router.register(r'servers', ServerViewSet)
router.register(r'presets', PresetViewSet)
router.register(r'configs', ConfigurationViewSet)
router.register(r'threads', ThreadViewSet)
router.register(r'chats', views.ChatViewSet)
router.register(r'multimedia-messages', views.MultimediaMessageViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path('builds/<int:pk>/', views.BuildDetailView.as_view(), name='build-detail'),
    path('checks/<int:pk>/', views.LinterCheckDetailView.as_view(), name='lintercheck-detail'),
    path('tests/<int:pk>/', views.TestRunDetailView.as_view(), name='testrun-detail'),
    path('operation-suites/', views.OperationSuiteListView.as_view(), name='operation-suite-list'),
    path('operation-suites/<int:pk>/', views.OperationSuiteDetailView.as_view(), name='operation-suite-detail')
]
