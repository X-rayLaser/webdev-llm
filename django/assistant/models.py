from django.db import models


class Server(models.Model):
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=500)
    description = models.TextField(blank=True, null=True)
    configuration = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.name


class Preset(models.Model):
    name = models.CharField(max_length=255)
    temperature = models.FloatField()
    top_k = models.IntegerField()
    top_p = models.FloatField()
    min_p = models.FloatField()
    repeat_penalty = models.FloatField()
    n_predict = models.IntegerField()
    extra_params = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.name


class Configuration(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    system_message = models.TextField(blank=True, null=True)
    
    preset = models.ForeignKey('Preset', on_delete=models.CASCADE)
    llm_server = models.ForeignKey('Server', on_delete=models.CASCADE, related_name='llm_configs')
    
    build_servers = models.ManyToManyField('Server', related_name='build_configs', blank=True)
    lint_servers = models.ManyToManyField('Server', related_name='lint_configs', blank=True)
    test_servers = models.ManyToManyField('Server', related_name='test_configs', blank=True)
    interaction_servers = models.ManyToManyField('Server', related_name='interaction_configs', blank=True)

    autorun = models.BooleanField(default=False)
    max_iterations = models.IntegerField(default=1)

    def __str__(self):
        return self.name
