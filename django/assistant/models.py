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
