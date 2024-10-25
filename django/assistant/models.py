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


class LinterCheck(Operation):
    logs = models.JSONField(blank=True, null=True)
    report = models.JSONField(blank=True, null=True)

    operation_suite = models.ForeignKey(OperationSuite, related_name="lints",
                                        blank=True, null=True, on_delete=models.CASCADE)


class TestRun(Operation):
    logs = models.JSONField(blank=True, null=True)
    report = models.JSONField(blank=True, null=True)

    operation_suite = models.ForeignKey(OperationSuite, related_name="tests",
                                        blank=True, null=True, on_delete=models.CASCADE)