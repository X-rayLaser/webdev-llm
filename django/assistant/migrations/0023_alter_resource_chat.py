# Generated by Django 5.1.5 on 2025-04-30 09:42

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0022_resource'),
    ]

    operations = [
        migrations.AlterField(
            model_name='resource',
            name='chat',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='resources', to='assistant.chat'),
        ),
    ]
