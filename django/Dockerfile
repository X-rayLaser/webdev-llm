FROM python:3.11

RUN groupadd --gid 1000 user && useradd -m --gid user --uid 1000 user

ENV PATH="$PATH:/home/user/.local/bin"

RUN apt-get update -y && apt-get install build-essential python3.11-venv -y

COPY . /django

RUN chown -R user: /django && chown -R user: /media

USER user

WORKDIR /home/user

RUN python -m venv venv

WORKDIR /django
RUN . /home/user/venv/bin/activate && pip install -r requirements.txt

ENTRYPOINT "./entrypoint.sh"
