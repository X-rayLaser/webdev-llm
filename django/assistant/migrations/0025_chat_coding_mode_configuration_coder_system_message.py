# Generated by Django 5.1.5 on 2025-07-25 09:00

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0024_chat_zipfile'),
    ]

    operations = [
        migrations.AddField(
            model_name='chat',
            name='coding_mode',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='configuration',
            name='coder_system_message',
            field=models.TextField(blank=True, null=True),
        ),
    ]
