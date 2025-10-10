FROM python:3.11

RUN groupadd --gid 1000 user && useradd -m --gid user --uid 1000 user

ENV PATH="$PATH:/home/user/.local/bin"

RUN apt-get update -y && apt-get install build-essential -y

COPY . /django

RUN chown -R user: /django && mkdir -p /data/media && mkdir -p /data/artifacts && chown -R user: /data

USER user

WORKDIR /home/user

RUN python -m venv venv

WORKDIR /django
RUN . /home/user/venv/bin/activate && pip install -r requirements.txt

ENTRYPOINT "./entrypoint.sh"
