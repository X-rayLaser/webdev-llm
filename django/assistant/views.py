from rest_framework import viewsets
from rest_framework import generics, mixins
from rest_framework import decorators
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

from .models import (
    Configuration, Server, Preset, Build, LinterCheck, TestRun, OperationSuite,
    Comment, Thread, Chat, MultimediaMessage, Modality, Generation, GenerationMetadata
)
from .serializers import (
    ConfigurationSerializer, ServerSerializer, PresetSerializer,
    BuildSerializer, LinterCheckSerializer, TestRunSerializer, OperationSuiteSerializer,
    ThreadSerializer, ChatSerializer, MultimediaMessageSerializer, ModalitySerializer,
    NewRevisionSerializer, CommentSerializer, ModalitiesOrderingSerializer,
    GenerationSerializer, GenerationMetadataSerializer, NewGenerationTaskSerializer
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


# todo: prevent updates
class ThreadViewSet(viewsets.ModelViewSet):
    queryset = Thread.objects.all()
    serializer_class = ThreadSerializer


# todo: prevent deletion
class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer


class MultimediaMessageViewSet(viewsets.ModelViewSet):
    queryset = MultimediaMessage.objects.all()
    serializer_class = MultimediaMessageSerializer

    @decorators.action(methods=['post'], detail=False)
    def make_revision(self, request):
        serializer = NewRevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ModalityViewSet(viewsets.ModelViewSet):
    queryset = Modality.objects.all()
    serializer_class = ModalitySerializer

    @decorators.action(methods=["post"], detail=True)
    def reorder(self, request, pk=None):
        data = dict(parent=pk, **request.data)
        serializer = ModalitiesOrderingSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({}, status=status.HTTP_204_NO_CONTENT)


class GenerationViewSet(mixins.CreateModelMixin,
                        mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    queryset = Generation.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        
        if status_filter:
            if status_filter == 'in_progress':
                queryset = queryset.filter(finished=False)
            elif status_filter == 'finished':
                queryset = queryset.filter(finished=True)
            elif status_filter == 'successful':
                queryset = queryset.filter(finished=True, errors__isnull=True)
        
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return NewGenerationTaskSerializer
        return GenerationSerializer
