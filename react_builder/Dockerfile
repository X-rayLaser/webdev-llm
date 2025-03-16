FROM node:20.17.0

ENV PATH="$PATH:/home/node/.local/bin"

RUN apt-get update -y && apt-get install build-essential python3-pip python3.11-venv -y

COPY . /app

RUN mkdir -p /data/builds \
    && mkdir -p /data/builds/node_modules \
    && cp /app/package.json /data/builds/package.json \
    && chown -R node: /data \
    && chown -R node: /app

USER node

WORKDIR /data/builds
RUN npm install

WORKDIR /home/node
RUN python3 -m venv venv

WORKDIR /app
RUN . /home/node/venv/bin/activate && pip install -r requirements.txt
