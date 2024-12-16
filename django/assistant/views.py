import math
from rest_framework import viewsets
from rest_framework import generics, mixins
from rest_framework import decorators
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
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
    GenerationSerializer, GenerationMetadataSerializer, NewGenerationTaskSerializer,
    BuildLaunchSerializer
)

from .tasks import summarize_text, generate_chat_picture

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


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def get_paginated_response(self, data):
        count = self.page.paginator.count
        num_pages = math.ceil(count / self.page_size)
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': count,
            'num_pages': num_pages,
            'results': data
        })


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    pagination_class = StandardResultsSetPagination
    # todo: fix tests if any were broken by this

    @decorators.action(methods=['post'], detail=False, url_path="start-new-chat")
    def start_new_chat(self, request):
        serializer = ChatSerializer(data=request.data, context={'request': request}) # todo: need to use new serializer with prompt field
        prompt = request.data["prompt"]
        # todo: automatically generate unique name for a chat
        
        serializer.is_valid(raise_exception=True)
        chat = serializer.save()
        modality = Modality.objects.create(modality_type="text", text=prompt)
        message = MultimediaMessage.objects.create(role="user", content=modality, chat=chat)

        backend_name = settings.SUMMARIZATION_BACKEND
        summarize_text.delay_on_commit(
            prompt, chat_id=chat.id, backend_name=backend_name, socket_session_id=0
        )

        text2im_backend_name = settings.TEXT_TO_IMAGE_BACKEND
        generate_chat_picture.delay_on_commit(
            prompt, chat_id=chat.id, backend_name=text2im_backend_name, socket_session_id=0
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        term = self.request.query_params.get("term", "")
        sortby = self.request.query_params.get("sortby", "newest")
        ordering = "-name" if sortby == "oldest" else "name"
        return self.queryset.filter(name__contains=term).order_by(ordering)

    @decorators.action(methods=['get'], detail=True)
    def generations(self, request, pk=None):
        chat = self.get_object()

        chat_messages = self.get_all_messages(chat)
        ids = chat_messages.values_list('id', flat=True)

        result_queryset = Generation.objects.filter(message__id__in=ids) | Generation.objects.filter(chat=chat)

        status_filter = self.request.query_params.get('status')
        result_queryset = filter_generations(result_queryset, status_filter)

        return Response(GenerationSerializer(result_queryset, many=True).data)

    def get_all_messages(self, chat):
        all_messages_queryset = MultimediaMessage.objects.none()
        def collect(msg):
            nonlocal all_messages_queryset
            all_messages_queryset = all_messages_queryset | msg.replies.all()
            for reply in msg.replies.all():
                collect(reply)

        for root in chat.messages.all():
            collect(root)

        return all_messages_queryset


class MultimediaMessageViewSet(viewsets.ModelViewSet):
    queryset = MultimediaMessage.objects.all()
    serializer_class = MultimediaMessageSerializer

    @decorators.action(methods=['post'], detail=False)
    def make_revision(self, request):
        serializer = NewRevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @decorators.action(methods=['post'], detail=True, url_path="launch-build")
    def launch_build(self, request, pk=None):
        ser = BuildLaunchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({})

    @decorators.action(methods=['post'], detail=True)
    def clone(self, request, pk=None):
        message = self.get_object()
        cloned_message = message.clone()

        serializer = MultimediaMessageSerializer(cloned_message)
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

    @decorators.action(methods=['post'], detail=True)
    def clone(self, request, pk=None):
        modality = self.get_object()
        cloned_modality = modality.clone()

        serializer = ModalitySerializer(cloned_modality)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GenerationViewSet(mixins.CreateModelMixin,
                        mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    queryset = Generation.objects.all()
    serializer_class = GenerationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        return filter_generations(queryset, status_filter)

    def create(self, request, *args, **kwargs):
        serializer = NewGenerationTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        generation = serializer.save()
        
        response_data = GenerationSerializer(generation).data
        return Response(response_data, status=status.HTTP_201_CREATED)


def filter_generations(queryset, status_filter):
    if status_filter:
        if status_filter == 'in_progress':
            queryset = queryset.filter(finished=False)
        elif status_filter == 'finished':
            queryset = queryset.filter(finished=True)
        elif status_filter == 'successful':
            queryset = queryset.filter(finished=True, errors__isnull=True)
    
    return queryset