from django.core.management.base import BaseCommand, CommandError
from assistant.models import MultimediaMessage


class Command(BaseCommand):
    help = "Adds a chat relation to every non-orphan message object"

    def handle(self, *args, **options):
        chatless = MultimediaMessage.objects.filter(chat__isnull=True)
        count = chatless.count()

        for i, message in enumerate(chatless):
            message.add_chat()
            message.save()
            if i % 50 == 0:
                self.stdout.write(
                    self.style.SUCCESS('Processed "%s" out of "%s" messages' % (i, count))
                )

        self.stdout.write(
            self.style.SUCCESS("Operation was successfully completed!")
        )
