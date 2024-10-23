from rest_framework import viewsets
from .models import Server
from .serializers import ServerSerializer


class ServerViewSet(viewsets.ModelViewSet):
    queryset = Server.objects.all()
    serializer_class = ServerSerializer
