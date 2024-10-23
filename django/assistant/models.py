from django.db import models


class Server(models.Model):
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=500)
    description = models.TextField(blank=True, null=True)
    configuration = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.name
