from django.core.management.utils import get_random_secret_key


if __name__ == '__main__':
    key = get_random_secret_key()
    secret_entry = f'SECRET_KEY="{key}"'
    print(secret_entry)
