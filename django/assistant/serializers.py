from rest_framework import serializers
from django.urls import reverse
from .models import (
    Configuration, Server, Preset, Build, LinterCheck,
    TestRun, OperationSuite, Thread, Comment, Modality,
    MultimediaMessage, Revision, Chat
)


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
        if self.instance is not None:
            if self.instance.modality_type == "code":
                raise serializers.ValidationError("Code modality cannot be directly updated")
        
            all_fields = set(data.keys())
            allowed_fields = set(["layout"])
            forbidden_fields = all_fields - allowed_fields
            if self.instance.modality_type == "mixture" and forbidden_fields:
                raise serializers.ValidationError(
                    f'These fields are immutable on mixed modality: {forbidden_fields}'
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
        fields = ['id', 'role', 'chat', 'parent', 'active_revision', 'content_ro', 'content', 'revisions', 'replies', 'src_tree']

    def get_replies(self, obj):
        return MultimediaMessageSerializer(obj.replies.all(), many=True).data

    def create(self, validatted_data):
        if 'src_tree' in validatted_data:
            src_tree = validatted_data.pop('src_tree')
        else:
            src_tree = ''
        message = super().create(validatted_data)
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
