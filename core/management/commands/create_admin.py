from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import os


class Command(BaseCommand):
    help = 'Создаёт суперпользователя из переменных окружения'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', 'admin')
        password = os.environ.get('ADMIN_PASSWORD', 'Admin123!')
        email = os.environ.get('ADMIN_EMAIL', 'admin@example.com')

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(
                f'Пользователь {username} уже существует'
            ))
            return

        User.objects.create_superuser(username, email, password)
        self.stdout.write(self.style.SUCCESS(
            f'Суперпользователь {username} создан'
        ))