from rest_framework import viewsets
from .models import Server, Preset
from .serializers import ServerSerializer, PresetSerializer


class ServerViewSet(viewsets.ModelViewSet):
    queryset = Server.objects.all()
    serializer_class = ServerSerializer


class PresetViewSet(viewsets.ModelViewSet):
    queryset = Preset.objects.all()
    serializer_class = PresetSerializer
