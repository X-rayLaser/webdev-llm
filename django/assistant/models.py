from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.db.models import Max


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


class Monitor:
    def __init__(self, suite, operations_reverse_relation):
        self.suite = suite
        self.operations_reverse_relation = operations_reverse_relation

    @property
    def running_operations(self):
        relation = self.get_relation()
        return relation.filter(finished=False)

    @property
    def crashed_operations(self):
        relation = self.get_relation()
        return relation.filter(finished=True, errors__isnull=False)

    @property
    def failed_operations(self):
        relation = self.get_relation()
        return relation.filter(finished=True, errors__isnull=True, success=False)

    @property
    def successful_operations(self):
        relation = self.get_relation()
        return relation.filter(finished=True, success=True)

    @property
    def all_finished(self):
        return self.running_operations.count() == 0

    @property
    def first_successful(self):
        return self.successful_operations.first()

    def get_relation(self):
        return getattr(self.suite, self.operations_reverse_relation)


class Revision(models.Model):
    src_tree = models.JSONField()
    message = models.ForeignKey("MultimediaMessage", related_name="revisions",
                                on_delete=models.CASCADE)


class OperationSuite(models.Model):
    revision = models.ForeignKey(Revision, related_name="suites", on_delete=models.CASCADE)

    @property
    def builds_monitor(self):
        return Monitor(self, "builds")

    @property
    def lints_monitor(self):
        return Monitor(self, "lints")

    @property
    def tests_monitor(self):
        return Monitor(self, "tests")

    @property
    def interactions_monitor(self):
        return Monitor(self, "interactions")

    @property
    def complete(self):
        return (self.builds_monitor.all_finished and 
                self.lints_monitor.all_finished and 
                self.tests_monitor.all_finished and 
                self.interactions_monitor.all_finished)


class Operation(models.Model):
    finished = models.BooleanField(default=False)
    success = models.BooleanField(blank=True, null=True)
    errors = models.JSONField(blank=True, null=True)
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True


class Build(Operation):
    logs = models.JSONField(blank=True, null=True)
    screenshot = models.ImageField(upload_to='screenshots/', blank=True, null=True)
    url = models.URLField(blank=True, null=True)

    operation_suite = models.ForeignKey(OperationSuite, related_name="builds",
                                        blank=True, null=True, on_delete=models.CASCADE)

    def get_absolute_url(self):
        return reverse('build-detail', args=[self.pk])


class LinterCheck(Operation):
    logs = models.JSONField(blank=True, null=True)
    report = models.JSONField(blank=True, null=True)

    operation_suite = models.ForeignKey(OperationSuite, related_name="lints",
                                        blank=True, null=True, on_delete=models.CASCADE)

    def get_absolute_url(self):
        return reverse('lintercheck-detail', args=[self.pk])


class TestRun(Operation):
    logs = models.JSONField(blank=True, null=True)
    report = models.JSONField(blank=True, null=True)

    operation_suite = models.ForeignKey(OperationSuite, related_name="tests",
                                        blank=True, null=True, on_delete=models.CASCADE)

    def get_absolute_url(self):
        return reverse('testrun-detail', args=[self.pk])


class Thread(models.Model):
    revision = models.ForeignKey(Revision, on_delete=models.CASCADE, related_name="threads")
    file_path = models.CharField(max_length=255)
    line_no = models.IntegerField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Thread in {self.file_path} at line {self.line_no}"


class Comment(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name="comments",
                               null=True, blank=True)
    text = models.TextField()
    parent = models.ForeignKey("self", on_delete=models.CASCADE, related_name="replies",
                               null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:50]


class Chat(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    configuration = models.ForeignKey('Configuration', on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class MultimediaMessage(models.Model):
    ROLE_CHOICES = [
        ('assistant', 'Assistant'),
        ('user', 'User'),
        ('system', 'System')
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages',
                             blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, related_name='replies',
                               blank=True, null=True)
    # todo: only active_revision can be updated
    active_revision = models.OneToOneField('Revision', on_delete=models.SET_NULL, 
                                           blank=True, null=True, related_name='active_message')
    created = models.DateTimeField(auto_now_add=True)

    content = models.OneToOneField("Modality", on_delete=models.CASCADE,
                                   related_name='content_message')

    def __str__(self):
        return f"{self.role.capitalize()} message in chat '{self.chat.name}'"


class Modality(models.Model):
    class ModalityType(models.TextChoices):
        TEXT = 'text', _('Text')
        IMAGE = 'image', _('Image')
        CODE = 'code', _('Code')
        MIXTURE = 'mixture', _('Mixture')

    modality_type = models.CharField(max_length=10, choices=ModalityType.choices)
    text = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='message_images/', blank=True, null=True)
    file_path = models.CharField(max_length=255, blank=True, null=True)

    mixed_modality = models.ForeignKey('self', on_delete=models.SET_NULL, related_name='mixture',
                                       blank=True, null=True)
    layout = models.JSONField(blank=True, null=True)

    order = models.PositiveSmallIntegerField(blank=True, null=True)

    def save(self, **kwargs):
        if self.mixed_modality is not None and self.order is None:
            parent = self.mixed_modality
            max_order = parent.mixture.aggregate(Max("order", default=0))
            self.order = max_order["order__max"] + 1

            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = {"order"}.union(update_fields)

        super().save(**kwargs)

    @property
    def source_paths(self):
        if self.modality_type == "code":
            return [self.file_path]
        elif self.modality_type == "mixture":
            paths = self.mixture.filter(
                modality_type="code"
            ).values_list("file_path", flat=True)
            paths = list(paths)
            for child_modality in self.mixture.filter(modality_type="mixture"):
                paths.extend(child_modality.source_paths)
            return paths
        else:
            return []

    def __str__(self):
        return f"{self.modality_type.capitalize()} modality"

    class Meta:
        ordering = ["order"]


class GenerationMetadata(models.Model):
    server = models.ForeignKey('Server', on_delete=models.CASCADE, related_name='generations')
    model_name = models.CharField(max_length=255, blank=True, null=True)
    params = models.JSONField(blank=True, null=True)
    response_metadata = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"GenerationMetadata for {self.server}"


class Generation(models.Model):
    task_id = models.CharField(max_length=255)
    finished = models.BooleanField(default=False)
    errors = models.JSONField(blank=True, null=True)
    start_time = models.DateTimeField(auto_now_add=True)
    stop_time = models.DateTimeField(blank=True, null=True)
    chat = models.ForeignKey('Chat', on_delete=models.SET_NULL,
                             blank=True, null=True, related_name='generations')
    # parent message of a message to be generated
    message = models.ForeignKey(MultimediaMessage, on_delete=models.SET_NULL,
                                blank=True, null=True, related_name='generations')
    generation_metadata = models.OneToOneField(GenerationMetadata, blank=True, null=True,
                                               on_delete=models.SET_NULL, related_name='generation')

    def __str__(self):
        return f"Generation {self.task_id} - Finished: {self.finished}"
