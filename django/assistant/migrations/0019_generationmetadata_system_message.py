# Generated by Django 5.1.5 on 2025-02-26 11:26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0018_alter_chat_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='generationmetadata',
            name='system_message',
            field=models.TextField(blank=True, null=True),
        ),
    ]
