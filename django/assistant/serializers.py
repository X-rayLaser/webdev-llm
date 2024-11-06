from operator import itemgetter
import uuid
from rest_framework import serializers
from django.conf import settings
from .models import (
    Configuration, Server, Preset, Build, LinterCheck,
    TestRun, OperationSuite, Thread, Comment, Modality,
    MultimediaMessage, Revision, Chat, Generation, GenerationMetadata
)
from assistant.tasks import generate_completion
from assistant.tasks import CompletionConfig


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
            'id', 'name', 'description', 'system_message', 'preset', 'llm_server',
            'build_servers', 'lint_servers', 'test_servers', 'interaction_servers',
            'autorun', 'max_iterations'
        ]


class BuildSerializer(serializers.ModelSerializer):
    class Meta:
        model = Build
        fields = ['id', 'logs', 'screenshot', 'url', 'finished', 'success', 'errors', 'start_time', 'end_time']


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

        def get_url(op): return op.get_absolute_url()

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
        fields = ['id', 'src_tree', 'message', 'threads', 'operation_suites']


class NewRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Revision
        fields = ['id', 'src_tree', 'message']


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


class MultimediaMessageSerializer(serializers.ModelSerializer):
    src_tree = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    content_ro = ModalitySerializer(source="content", read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = MultimediaMessage
        fields = ['id', 'role', 'chat', 'parent', 'active_revision',
                  'content_ro', 'content', 'revisions', 'replies', 'src_tree']

    def get_replies(self, obj):
        return MultimediaMessageSerializer(obj.replies.all(), many=True).data

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
            if message.content.modality_type == "code":
                path = message.content.file_path
                contents = [entry["content"] for entry in src_tree if entry["file_path"] == path]
                if contents:
                    Revision.objects.create(src_tree=src_tree, message=message)
        return message


class ChatSerializer(serializers.HyperlinkedModelSerializer):
    configuration = serializers.HyperlinkedRelatedField(
        queryset=Configuration.objects.all(),
        view_name='configuration-detail',
        read_only=False
    )
    messages = serializers.HyperlinkedRelatedField(
        many=True,
        view_name='multimedia-message-detail',
        read_only=True
    )

    class Meta:
        model = Chat
        fields = ['id', 'name', 'description', 'configuration', 'messages', 'created']


class GenerationMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenerationMetadata
        fields = ['id', 'server', 'model_name', 'params', 'response_metadata']


class GenerationSerializer(serializers.ModelSerializer):
    generation_metadata = GenerationMetadataSerializer()

    class Meta:
        model = Generation
        fields = [
            'id', 'task_id', 'finished', 'errors', 'start_time', 'stop_time',
            'chat', 'message', 'generation_metadata'
        ]

        read_only_fields = ['task_id', 'finished', 'errors', 'start_time',
                            'stop_time', 'generation_metadata']


class NewGenerationTaskSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(max_length=255, write_only=True, required=False)
    params = serializers.DictField(write_only=True, required=False)

    class Meta:
        model = Generation
        fields = ['id', 'model_name', 'params', 'chat', 'message']

    def create(self, validated_data):
        # todo: add validation
        model_name = validated_data.get("model_name", "")
        params = validated_data.get("params", {})

        chat = validated_data.get("chat")
        message = validated_data.get("message")
        message_id = message.id if message is not None else None

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
                                             message_id=message_id)
        generate_completion.delay_on_commit(completion_config.to_dict())

        metadata = GenerationMetadata.objects.create(server=server, model_name=model_name, 
                                                     params=params)
        # todo: prepare a list of messages for LLM
        return Generation.objects.create(task_id=job_id, chat=chat, message=message,
                                         generation_metadata=metadata)