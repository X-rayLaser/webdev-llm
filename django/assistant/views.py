import math
import json
from rest_framework.decorators import api_view
from rest_framework import viewsets
from rest_framework import generics, mixins
from rest_framework import decorators
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.conf import settings
from django.shortcuts import get_object_or_404


from .models import (
    Configuration, Server, Preset, Build, LinterCheck, TestRun, OperationSuite,
    Comment, Thread, Chat, MultimediaMessage, Modality, Generation, GenerationMetadata,
    Revision, SpeechSample, Resource, reduce_source_tree
)
from .serializers import (
    ConfigurationSerializer, ServerSerializer, PresetSerializer,
    BuildSerializer, LinterCheckSerializer, TestRunSerializer, OperationSuiteSerializer,
    ThreadSerializer, ChatSerializer, MultimediaMessageSerializer, ModalitySerializer,
    RevisionSerializer, NewRevisionSerializer, CommentSerializer, ModalitiesOrderingSerializer,
    GenerationSerializer, GenerationMetadataSerializer, NewGenerationTaskSerializer,
    BuildLaunchSerializer, MakeRevisionSerializer, SpeechSampleSerializer, ResourceSerializer
)

from .tasks import summarize_text, generate_chat_picture
from .utils import fix_newlines


class BinaryRenderer(BaseRenderer):
    media_type = 'application/octet-stream'
    format = 'bin'
    render_style = 'binary'
    charset = None

    def render(self, data, media_type=None, renderer_context=None):
        view = renderer_context['view']

        with open(view.get_object().audio.path, 'rb') as f:
            return f.read()


class SpeechSampleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SpeechSampleSerializer
    queryset = SpeechSample.objects.all()
    renderer_classes = [BinaryRenderer]

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)


class RevisionViewSet(viewsets.GenericViewSet):
    queryset = Revision.objects.all()
    serializer_class = RevisionSerializer

    @decorators.action(methods=['get'], detail=True, url_path="source_trees")
    def source_trees(self, request, pk=None):
        revision = self.get_object()
        source_tree = reduce_source_tree(revision)
        return Response(source_tree)

    @decorators.action(methods=['post'], detail=True, url_path="launch-build")
    def launch_build(self, request, pk=None):
        build_server = request.data.get('build_server')
        params = request.data.get('params', {})
        data = dict(revision=pk)

        if build_server or build_server == 0:
            data['build_server'] = build_server
        if params:
            data['params'] = params
        ser = BuildLaunchSerializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({})

    @decorators.action(methods=['post'], detail=True, url_path="make_revision")
    def make_revision(self, request, pk=None):
        data = request.data.copy()
        data.update(parent_revision=pk)
        ser = MakeRevisionSerializer(data=data)
        ser.is_valid(raise_exception=True)
        new_revision = ser.save()
        return Response(RevisionSerializer(new_revision, context={'request': request}).data)


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



class ResourceViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    pagination_class = StandardResultsSetPagination
    # todo: fix tests if any were broken by this

    @decorators.action(methods=['get'], detail=True)
    def last_text(self, request, pk=None):
        chat = self.get_object()
        text = chat.get_last_text()
        return Response({'last_text': text})

    @decorators.action(methods=['get'], detail=True, url_path="revisions")
    def revisions(self, request, pk=None):
        chat = self.get_object()
        revisions = chat.get_revisions()
        ser = RevisionSerializer(revisions, many=True, context={'request': request})
        return Response(ser.data)

    @decorators.action(methods=['post'], detail=False, url_path="start-new-chat")
    def start_new_chat(self, request):
        serializer = ChatSerializer(data=request.data, context={'request': request}) # todo: need to use new serializer with prompt field
        prompt = request.data["prompt"]
        prompt = fix_newlines(prompt)

        resources_str = request.data.get("resources", "")

        # todo: automatically generate unique name for a chat
        
        serializer.is_valid(raise_exception=True)
        chat = serializer.save()
        modality = Modality.objects.create(modality_type="text", text=prompt)
        message = MultimediaMessage.objects.create(role="user", content=modality, chat=chat)

        if resources_str:
            resource_ids = json.loads(resources_str)
            resources = Resource.objects.filter(id__in=resource_ids)
            chat.resources.add(*resources)
            chat.save()

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
        ordering = "created" if sortby == "oldest" else "-created"
        filter = self.request.query_params.get("filter", "all")

        queryset = self.queryset
        if filter != "all":
            revision_chat_ids = Revision.objects.all().values_list('message__chat__id', flat=True)

            if filter == "withCode":
                queryset = self.queryset.filter(id__in=revision_chat_ids)
            elif filter == "noCode":
                queryset = self.queryset.exclude(id__in=revision_chat_ids)

        return queryset.filter(name__contains=term).order_by(ordering).distinct()

    @decorators.action(methods=['get'], detail=True)
    def generations(self, request, pk=None):
        chat = self.get_object()

        chat_messages = self.get_all_messages(chat)

        ids = list(chat_messages.values_list('id', flat=True))
    
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

    def get_serializer(self, *args, **kwargs):
        is_lite = self.request.query_params.get('lite')
        if self.action in ['list', 'retrieve'] and is_lite:
            kwargs["with_replies"] = False
        return super().get_serializer(*args, **kwargs)


    @decorators.action(methods=['post'], detail=True)
    def regenerate(self, request, pk=None):
        """Regenerate a message for a parent message with a given pk"""
        message = self.get_object()

        config = message.get_root().chat.configuration
        model_name = config.llm_model or "llama3.2"
        params = PresetSerializer(config.preset).data

        last_generation = message.get_last_generation()

        system_message = None

        if last_generation:
            metadata = last_generation.generation_metadata
            model_name = metadata.model_name or model_name
            params = metadata.params or params
            system_message = metadata.system_message

        data = dict(model_name=model_name, params=params, message=message.id)

        if system_message:
            data["system_message"] = system_message

        response_data = start_message_generation(data=data)
        return Response(response_data, status=status.HTTP_201_CREATED)

    @decorators.action(methods=['post'], detail=False)
    def make_revision(self, request):
        serializer = NewRevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @decorators.action(methods=['post'], detail=True, url_path="launch-build")
    def launch_build(self, request, pk=None):
        # deprecated (superseded by RevisionViewset.launch_build
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
        response_data = start_message_generation(data=request.data)
        return Response(response_data, status=status.HTTP_201_CREATED)


def start_message_generation(data):
    serializer = NewGenerationTaskSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    generation = serializer.save()
    return GenerationSerializer(generation).data


def filter_generations(queryset, status_filter):
    if status_filter:
        if status_filter == 'in_progress':
            queryset = queryset.filter(finished=False)
        elif status_filter == 'finished':
            queryset = queryset.filter(finished=True)
        elif status_filter == 'successful':
            queryset = queryset.filter(finished=True, errors__isnull=True)
    
    return queryset
