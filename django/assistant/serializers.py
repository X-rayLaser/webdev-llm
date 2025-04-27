from operator import itemgetter
import uuid
from rest_framework import serializers
from django.conf import settings
from .models import (
    Configuration, Server, Preset, Build, LinterCheck,
    TestRun, OperationSuite, Thread, Comment, Modality,
    MultimediaMessage, Revision, Chat, Generation, GenerationMetadata,
    SpeechSample
)
from assistant.tasks import generate_completion, launch_operation_suite, CompletionConfig
from assistant.utils import fix_newlines, get_multimedia_message_text

class ServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Server
        fields = ['id', 'name', 'url', 'description', 'configuration']


class PresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preset
        fields = [
            'id', 'name', 'temperature', 'top_k', 'top_p', 'min_p',
            'repeat_penalty', 'n_predict', 'extra_params'
        ]


class ConfigurationSerializer(serializers.ModelSerializer):
    preset = serializers.SlugRelatedField(slug_field='name',
                                          queryset=Preset.objects.all())
    llm_server = serializers.SlugRelatedField(slug_field='name',
                                              queryset=Server.objects.all())
    build_servers = serializers.SlugRelatedField(slug_field='name',
                                                 queryset=Server.objects.all(), many=True)
    lint_servers = serializers.SlugRelatedField(slug_field='name',
                                                queryset=Server.objects.all(), many=True)
    test_servers = serializers.SlugRelatedField(slug_field='name',
                                                queryset=Server.objects.all(), many=True)
    interaction_servers = serializers.SlugRelatedField(slug_field='name', 
                                                       queryset=Server.objects.all(), many=True)

    class Meta:
        model = Configuration
        fields = [
            'id', 'name', 'llm_model', 'description', 'system_message', 'preset', 'llm_server',
            'build_servers', 'lint_servers', 'test_servers', 'interaction_servers',
            'autorun', 'max_iterations'
        ]


class BuildSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField()

    class Meta:
        model = Build
        fields = ['id', 'logs', 'screenshot', 'url', 'finished', 'success', 'errors', 'start_time', 'end_time', 'state']

    def get_state(self, obj):
        if not obj.finished:
            return "running"
        
        if obj.errors:
            return "crashed"
        
        if not obj.success:
            return "failed"
        
        return "successful"


class LinterCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = LinterCheck
        fields = ['id', 'logs', 'report', 'finished', 'success', 'errors', 'start_time', 'end_time']


class TestRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestRun
        fields = ['id', 'logs', 'report', 'finished', 'success', 'errors', 'start_time', 'end_time']


class OperationSuiteSerializer(serializers.ModelSerializer):
    builds = serializers.SerializerMethodField()
    lints = serializers.SerializerMethodField()
    tests = serializers.SerializerMethodField()

    class Meta:
        model = OperationSuite
        fields = ['id', 'builds', 'lints', 'tests']

    def get_operation_hyperlinks(self, monitor):
        states = {
            "running": monitor.running_operations,
            "crashed": monitor.crashed_operations,
            "failed": monitor.failed_operations,
            "successful": monitor.successful_operations
        }

        def get_url(op): return self.context['request'].build_absolute_uri(op.get_absolute_url())

        return {state: list(map(get_url, ops)) for state, ops in states.items()}

    def get_builds(self, obj):
        return self.get_operation_hyperlinks(obj.builds_monitor)

    def get_lints(self, obj):
        return self.get_operation_hyperlinks(obj.lints_monitor)

    def get_tests(self, obj):
        return self.get_operation_hyperlinks(obj.tests_monitor)


class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'text', 'parent', 'timestamp', 'replies']

    def get_replies(self, obj):
        children = Comment.objects.filter(parent=obj).order_by('timestamp')
        return CommentSerializer(children, many=True).data


class ThreadSerializer(serializers.ModelSerializer):
    comment_tree = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = ['id', 'revision', 'file_path', 'line_no', 'timestamp', 'comment_tree']

    def get_comment_tree(self, obj):
        # Fetch root comments (those without parents)
        root_comments = Comment.objects.filter(thread=obj, parent__isnull=True).order_by('timestamp')
        return CommentSerializer(root_comments, many=True).data


class RevisionSerializer(serializers.ModelSerializer):
    message = serializers.HyperlinkedRelatedField(
        view_name='multimediamessage-detail', read_only=True
    )
    threads = serializers.HyperlinkedRelatedField(
        view_name='thread-detail', many=True, read_only=True
    )
    operation_suites = serializers.HyperlinkedRelatedField(
        view_name='operation-suite-detail', many=True, read_only=True, source='suites'
    )

    class Meta:
        model = Revision
        fields = ['id', 'src_tree', 'created', 'message', 'threads', 'operation_suites']


class NewRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Revision
        fields = ['id', 'src_tree', 'message']


class MakeRevisionSerializer(serializers.Serializer):
    parent_revision = serializers.PrimaryKeyRelatedField(queryset=Revision.objects.all(), many=False)
    commit_text = serializers.CharField(max_length=1024, default="I made some changes to the files")
    src_tree = serializers.JSONField()

    def create(self, validated_data):
        parent_rev = validated_data.pop('parent_revision')
        parent_msg = parent_rev.message

        text = validated_data.pop('commit_text')
        sources = validated_data.pop('src_tree')

        modality_container = Modality.objects.create(modality_type="mixture")
        Modality.objects.create(modality_type="text", text=text, mixed_modality=modality_container)

        for src in sources:
            if 'file_path' in src and 'deleted' not in src:
                file_path = src["file_path"]
                Modality.objects.create(
                    modality_type="code", file_path=file_path, mixed_modality=modality_container
                )

        role = "assistant" if parent_msg.role == "user" else "user"

        # todo: use atomic context manager (increment child index only if remaining code succeeds)
        parent_msg.child_index = parent_msg.replies.count()
        parent_msg.save()
        new_message = MultimediaMessage.objects.create(
            role=role, content=modality_container, parent=parent_msg
        )

        revision = Revision.objects.create(message=new_message, src_tree=sources)
        new_message.active_revision = revision
        new_message.save()
        return revision


class ModalitySerializer(serializers.ModelSerializer):
    mixture = serializers.SerializerMethodField()

    class Meta:
        model = Modality
        fields = ['id', 'modality_type', 'text', 'image', 'file_path', 
                  'mixed_modality', 'mixture', 'layout', 'order']

    def get_mixture(self, obj):
        if obj.mixture.exists():
            objs = ModalitySerializer(obj.mixture.order_by("order"), many=True).data
            return objs
        return []

    def validate_text(self, data):
        is_being_created = bool(self.instance is None)

        if is_being_created:
            data = fix_newlines(data)
            
        return data

    def validate(self, data):
        
        all_fields = set(data.keys())

        if self.instance is not None:
            common_fields = all_fields.intersection(["modality_type", "mixed_modality"])
            if common_fields:
                raise serializers.ValidationError(f'This field is immutable: {common_fields}')

            modality_type = self.instance.modality_type
            if modality_type == "text":
                allowed_fields = set(["text", "order"])
            elif modality_type == "image":
                allowed_fields = set(["image", "order"])
            elif modality_type == "code":
                raise serializers.ValidationError("Code modality cannot be directly updated")
            elif modality_type == "mixture":
                allowed_fields = set(["layout"])
            else:
                allowed_fields = set()

            forbidden_fields = all_fields - allowed_fields
            if forbidden_fields:
                raise serializers.ValidationError(
                    f'These fields are immutable on "{modality_type}" modality: {forbidden_fields}'
                )
        return data


class ModalitiesOrderingSerializer(serializers.Serializer):
    parent = serializers.PrimaryKeyRelatedField(queryset=Modality.objects.all())

    modalities = serializers.PrimaryKeyRelatedField(
        queryset=Modality.objects.all(),
        many=True
    )

    def validate_modalities(self, modalities):
        if len(modalities) != len(set(modalities)):
            raise serializers.ValidationError("All modality ids must not contain duplicates")

        parent = modalities[0].mixed_modality

        if parent.mixture.count() != len(modalities):
            raise serializers.ValidationError(
                "Complete set of child modalities of a parent must be submited"
            )
        return modalities

    def validate_parent(self, parent):
        if parent.modality_type != "mixture":
            raise serializers.ValidationError(
                "Parent modality must be a mixture of modalities"
            )
        return parent

    def validate(self, data):
        parent = data["parent"]
        modalities = data["modalities"]

        for mod in modalities:
            if mod.mixed_modality != parent:
                raise serializers.ValidationError(
                    "All modalities must be children of the parent modality."
                )

        return data

    def save(self):
        modalities = self.validated_data["modalities"]
        for modality, order in zip(modalities, range(1, len(modalities) + 1)):
            modality.order = order
            modality.save(update_fields=["order"])


# todo: validate child_index
class MultimediaMessageSerializer(serializers.ModelSerializer):
    src_tree = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    content_ro = ModalitySerializer(source="content", read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    replies = serializers.SerializerMethodField()
    tts_text = serializers.SerializerMethodField()

    class Meta:
        model = MultimediaMessage
        fields = ['id', 'role', 'chat', 'parent', 'active_revision',
                  'content_ro', 'content', 'audio', 'revisions', 'replies', 'src_tree', 
                  'child_index', 'tts_text']

    def __init__(self, *args, **kwargs):
        with_replies = kwargs.pop('with_replies', True)
        super().__init__(*args, **kwargs)
        if not with_replies:
            self.fields.pop('replies')

    def get_replies(self, obj):
        kwargs = dict(context=self.context) if hasattr(self, "context") else {}
        return MultimediaMessageSerializer(obj.replies.all(), many=True, **kwargs).data

    def get_tts_text(self, obj):
        return get_multimedia_message_text(obj)

    def validate_src_tree(self, data):
        for entry in data:
            keys_present = "file_path" in entry and "content" in entry
            if not keys_present:
                raise serializers.ValidationError(
                    "Source tree entries must contain both 'file_path' and 'content' fields"
                )
        return data

    def validate(self, data):
        is_being_created = bool(self.instance is None)
        error_msg = "Source tree must contain exactly the same files as those referenced in code modalities"
        if is_being_created:
            src_tree = data.get('src_tree', [])
            modality = data["content"]
            paths = list(sorted(modality.source_paths))

            get_path = itemgetter("file_path")
            data_paths = list(sorted(map(get_path, src_tree)))

            if paths != data_paths:
                raise serializers.ValidationError(error_msg)

        return data

    def create(self, validated_data):
        if 'src_tree' in validated_data:
            src_tree = validated_data.pop('src_tree')
        else:
            src_tree = ''

        message = super().create(validated_data)
        if src_tree:
            revision = Revision.objects.create(src_tree=src_tree, message=message)
            message.active_revision = revision
            message.save()

        if message.parent is not None:
            parent = message.parent
            parent.child_index = parent.replies.count() - 1
            parent.save()
        return message


class ChatSerializer(serializers.HyperlinkedModelSerializer):
    configuration = serializers.HyperlinkedRelatedField(
        queryset=Configuration.objects.all(),
        view_name='configuration-detail',
        read_only=False
    )
    messages = serializers.HyperlinkedRelatedField(
        many=True,
        view_name='multimediamessage-detail',
        read_only=True
    )

    class Meta:
        model = Chat
        fields = ['id', 'name', 'description', 'configuration', 'image', 'messages', 'created']


class GenerationMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenerationMetadata
        fields = ['id', 'server', 'model_name', 'params', 'response_metadata', 'system_message']


class GenerationSerializer(serializers.ModelSerializer):
    generation_metadata = GenerationMetadataSerializer()

    class Meta:
        model = Generation
        fields = [
            'id', 'task_id', 'finished', 'errors', 'start_time', 'stop_time',
            'chat', 'message', 'generation_metadata', 'generation_type'
        ]


class NewGenerationTaskSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(max_length=255, required=False)
    params = serializers.DictField(required=False)
    system_message = serializers.CharField(max_length=4096, required=False)

    class Meta:
        model = Generation
        fields = ['id', 'model_name', 'params', 'chat', 'message', 'system_message']

    def validate(self, attrs):
        chat = attrs.get('chat')
        message = attrs.get('message')
        
        if (chat is None and message is None) or (chat is not None and message is not None):
            raise serializers.ValidationError(
                "Exactly one of 'chat' or 'message' must be provided."
            )
        
        return attrs

    def create(self, validated_data):
        # todo: add validation
        model_name = validated_data.get("model_name", "")
        params = validated_data.get("params", {})

        chat = validated_data.get("chat")
        message = validated_data.get("message")
        message_id = message.id if message is not None else None
        system_message = validated_data.get("system_message")

        if chat is None:
            root = message.get_root()
            chat = root.chat

        server = chat.configuration.llm_server

        backend_name = settings.GENERATION_BACKEND

        job_id = uuid.uuid4().hex

        completion_config = CompletionConfig(backend_name,
                                             task_id=job_id,
                                             server_url=server.url,
                                             model_name=model_name,
                                             params=params,
                                             chat_id=chat.id,
                                             message_id=message_id,
                                             system_message=system_message)
        # todo: pass valid socket_session_id parameter
        generate_completion.delay_on_commit(completion_config.to_dict(), 0)

        metadata = GenerationMetadata.objects.create(server=server, model_name=model_name, 
                                                     params=params, system_message=system_message)

        return Generation.objects.create(task_id=job_id, chat=chat, message=message,
                                         generation_metadata=metadata)


class BuildLaunchSerializer(serializers.Serializer):
    revision = serializers.PrimaryKeyRelatedField(queryset=Revision.objects.all())
    build_server = serializers.PrimaryKeyRelatedField(queryset=Server.objects.all(), required=False)
    # todo: check validation
    params = serializers.JSONField(required=False)

    def save(self):
        revision = self.validated_data["revision"]
        server = self.validated_data.get("build_server")
        params = self.validated_data.get("params", {})
        builder_id = server and server.id
        launch_operation_suite.delay_on_commit(
            revision.id, socket_session_id=0, builder_id=builder_id, build_params=params
        )


class SpeechSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpeechSample
        fields = ['id', 'text', 'audio']