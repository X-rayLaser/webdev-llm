# Introduction

Simple to use and flexibile self-hosted web-based GUI for running open-weight LLMs for chatting and coding.


## Main features:
- multimodal (text+vision input) models support
- previewing generated React components
- drawing on canvas
- multiple branches within one chat
- editable messages (both AI and human ones)

## Requirements

1. Docker
2. Docker Compose

# Getting started

Clone repository:

```
git clone
cd llm-dev
```

Build it:
```
docker-compose build
```
or
```
docker compose build
```

Run it:
```
docker-compose up
```
or
```
docker compose up
```

In the browser, go to [localhost/app/chats](localhost/app/chats)

# Configuring

Before you can start chatting with the LLM, you need to configure the app:

In the browser, go to [localhost/app/configuration](localhost/app/configuration)

## Pointing the GUI to an LLM inference server

First thing you need to do is to tell the app the location of your LLM server.

To do so, press the big button in the top most panel and fill in the form. You will need to provide a base URL of an LLM inference server that you want to use (e.g. Ollama).
The URL should be of this form:
```
http://<your domain name>:<port number>
```

The app itself is agnostic of which LLM server you use.
However, the server must provide openai-compatible API endpoint for inference. For example, you can use Ollama or Llama.cpp server.

Note that since the app is running inside docker container, you cannot use localhost to access the LLM server (even in case of locally running LLM server). Instead, you have to find out the IP address of a bridge docker0 (typically it's 172.17.0.1/). This way, any request made within docker containers to http://172.17.0.1 will be correctly routed to your host OS (rather than docker container host).

For example, if you run Ollama on your host machine and your docker bridge IP=172.17.0.1, and the port number that Ollama API uses is 11434, you should fill in the URL field as follows:
```
http://172.17.0.1:11434
```

In addition, you may need to tweak your host firewall rules to allow incoming traffic from within docker network hosting the app.

## Creating and configuring presets

Second, you need to create 1 or more presets that control LLM sampling parameters (such as temperature).
Click the big button in the second panel to do so.

## Creating final configuration

Finally, click the button in the lowest panel to create your final configuration.
Pick an appropriate name for it, choose which LLM server and a preset from the dropdown menus.

# Chatting with a model

In the browser, go to [localhost/app/chats](localhost/app/chats).

Start a new chat by choosing a configuration from a dropdown shown in the main form on the page.
Then, enter your prompt and click the submit button.
You will be redirected to the chat page.

Unlike typical LLM chat UI, where you send your prompt and get response, this app gives you more control. At each point in conversation you can either write a message yourself (whether it's supposed to be your turn or AI's turn) or use LLM to generate it.

A few interesting things that you can do:
- create messages by interleaving images and text in arbitrary order
- draw something on a canvas and send it to LLM
- ask AI to implement a React component and see how it looks
- pretend to be an AI and write it's response

Have fun!

# License

MIT