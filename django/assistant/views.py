from rest_framework import viewsets
from rest_framework import generics


from .models import (
    Configuration, Server, Preset, Build, LinterCheck, TestRun, OperationSuite,
    Thread, Chat
)
from .serializers import (
    ConfigurationSerializer, ServerSerializer, PresetSerializer,
    BuildSerializer, LinterCheckSerializer, TestRunSerializer, OperationSuiteSerializer,
    ThreadSerializer, ChatSerializer
)


class ServerViewSet(viewsets.ModelViewSet):
    queryset = Server.objects.all()
    serializer_class = ServerSerializer


class PresetViewSet(viewsets.ModelViewSet):
    queryset = Preset.objects.all()
    serializer_class = PresetSerializer


class ConfigurationViewSet(viewsets.ModelViewSet):
    queryset = Configuration.objects.all()
    serializer_class = ConfigurationSerializer


class BuildDetailView(generics.RetrieveAPIView):
    queryset = Build.objects.all()
    serializer_class = BuildSerializer


class LinterCheckDetailView(generics.RetrieveAPIView):
    queryset = LinterCheck.objects.all()
    serializer_class = LinterCheckSerializer


class TestRunDetailView(generics.RetrieveAPIView):
    queryset = TestRun.objects.all()
    serializer_class = TestRunSerializer


class OperationSuiteListView(generics.ListAPIView):
    queryset = OperationSuite.objects.all()
    serializer_class = OperationSuiteSerializer


class OperationSuiteDetailView(generics.RetrieveAPIView):
    queryset = OperationSuite.objects.all()
    serializer_class = OperationSuiteSerializer


class ThreadViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Thread.objects.all()
    serializer_class = ThreadSerializer


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
