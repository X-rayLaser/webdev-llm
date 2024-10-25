from rest_framework import serializers
from .models import Configuration, Server, Preset, Build, LinterCheck, TestRun


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
