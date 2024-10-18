. /home/user/venv/bin/activate

if [ ! -f "mysite/secrets.py" ]; then
    python generate_key.py > mysite/secrets.py
fi

python manage.py migrate
python manage.py runserver 0.0.0.0:8000
