# Introduction

Simple to use and flexibile self-hosted web-based GUI for running open-weight LLMs for chatting and coding.


## Main features:
- multimodal (text+vision input) models support
- simple IDE for editing generated files
- viewing file changes
- previewing generated React components (experimental)
- easily pluggable custom code builders
- canvas for sketching react components
- conversation branching
- editable messages (both AI and human ones)
- image upload
- pasting images from clipboard
- taking picture with a camera
- pluggable RAG
- pluggable TTS

## Requirements

1. Docker
2. Docker Compose


# Warning: not suitable for production

This project is only suitable for running locally. Please, do not run it in production environment.

# Getting started

Clone repository:

```
git clone https://github.com/X-rayLaser/webdev-llm.git
cd webdev-llm
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

In the browser, go to [http://localhost/app/chats](http://localhost/app/chats)

# Configuring

Before you can start chatting with the LLM, you need to configure the app:

In the browser, go to [http://localhost/app/configuration](http://localhost/app/configuration)

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
Pick an appropriate name for it, choose which LLM server and a preset to use from the dropdown menus.

# Chatting with a model

In the browser, go to [http://localhost/app/chats](http://localhost/app/chats).

Start a new chat by choosing a configuration from a dropdown shown in the main form on the page.
Then, enter your prompt and click the submit button.
You will be redirected to the chat page.

Unlike typical LLM chat UI, where you send your prompt and get response, you have more control. At each point in conversation you can either write a message yourself (regardless of whether it's supposed to be your turn or AI's turn) or use LLM to generate it.

A few interesting things that you can do:
- create messages by interleaving images and text in arbitrary order
- draw something on a canvas and send it to LLM
- ask AI to implement a React component and see how it looks
- pretend to be an AI and write it's response

Have fun!

---

# How to enable RAG using your own retrieval server

This section describes how to enable Retrieval Augment Generation using your local retrieval server.

1. Create django/mysite/settings_local.py if it does not exist

2. Ensure that retrieval server is up and running. Server should implement at least
1 endpoint accepting HTTP body with content type `application/json` and responding with
plain text containing top few passages relevant to the prompt.

3. Add this setting to the settings_local.py file:
```
RAG_BACKEND = {
    "name": "simple",
    "kwargs": {
        "url": <YOUR RETRIEVAL SERVER URL>,
        "method": <HTTP METHOD>,
        "paylod_key: <PROMPT>
    }
}
```

method and payload_key are optional arguments defaulting to "post" and "prompt" respectively.

Here is an example of the setting for a retrieval server running at `http://172.17.0.1:8024/search`
accepting POST requests and expecting the prompt to be available under key "prompt":
```
RAG_BACKEND = {
    "name": "simple",
    "kwargs": {
        "url": "http://172.17.0.1:8024/search",
        "method": "post",
        "paylod_key: "prompt"
    }
}
```

# How to enable Text-To-Speech (TTS)

This section describes how to add tts support using locally running TTS server.

## TTS server specification

The server should have one POST endpoint that accepts json data (with fields text and sample_name) and responds with valid WAV data.

Specifically:

HTTP endpoint: POST /tts/

Request content type: `application/json`

Request data: {
  "text": "Sentence to be converted to speech",
  "sample_name": "voice sample ID or name"
}

Response content type: `application/octet-stream`
Response data: raw audio bytes containing valid WAV data.

## Configuring

Once you have implemented your TTS server, you can plug it as follows:

1. Create django/mysite/settings_local.py if it does not exist

2. Ensure that server is up and running

3. Set the setting TTS_BACKEND in settings_local.py as follows:
```
TTS_BACKEND = {
    "name": "remote_tts",
    "kwargs": { 
        "host": <SERVER IP ADDRESS>,
        "port": <SERVER PORT NUMBER>,
        "default_voice": <VOICE SAMPLE ID/NAME TO USE FOR TTS>,
        "use_tls": False
    }
}
```

Here is an example of setting for a TTS server running at http://172.17.0.1:10001/tts/:
```
TTS_BACKEND = {
    "name": "remote_tts",
    "kwargs": { 
        "host": "172.17.0.1",
        "port": 10001,
        "default_voice": "main",
        "use_tls": False
    }
}
```

# Toggle LLM use for file name extraction

Sometimes generated code contains code snippets or entire files in some programming languages.
Whenever this happens, the app attempts to extract or give names to these files.
By default, it uses manually programmed heuristics to accomplish this. It does not always work well though.
For that reason, you may be interested allowing LLM to this job instead. You can do so by adding the
`LLM_BASED_NAME_EXTRACTION` setting in django/mysite/settings_local.py:
```
LLM_BASED_NAME_EXTRACTION = True
```

Note that setting it to True will reuse the model selected for responses. As a result, it may slow down overall performance
and use more tokens. The slow down will be especially noticeable when selecting a reasoning model producing long chains of thought before answering.

# Customization via Django settings (Backends)

This project is designed so that “power users” can swap out the AI/ML backends without modifying core code.
Each backend type has a small interface and is selected via Django settings.
Each setting accepts a backend key from the built-in options or a custom backend you register yourself.

## Backend purposes

* **Generation backends** – Produce text or code completions given a user request. These are the core “thinking” engines of the assistant, ranging from simple dummy outputs for testing to API-driven large language models.

* **Summarization backends** – Generate short chat titles from conversation history. Used to give each chat a meaningful, human-readable label.

* **Text-to-Image backends** – Create thumbnail images for chats based on their content or title. Useful for quick visual identification in the UI.

* **RAG (Retrieval-Augmented Generation) backends** – Fetch relevant information from a knowledge base or external service and inject it into the model’s context to improve accuracy and relevance.

* **TTS (Text-to-Speech) backends** – Convert text into spoken audio. Can provide voice responses in a variety of formats and voices, or be disabled entirely.

---

## Built-in backends: purposes and setup

Below is a quick reference for all built-in backend implementations, what they do, and how to configure them.

### **Generation backends**

* **`openai_compatible`**

  *Purpose:* Uses an external LLM service that exposes an OpenAI-compatible Chat Completions API to generate responses.

  *Typical use cases:* Connecting to `llama.cpp` server, [Ollama](https://ollama.com/), or any other service speaking the `/v1/chat/completions` protocol.

  *Setup:*

  * Set the GENERATION_BACKEND backend key to `"openai_compatible"`.
  * Optional: configure `http_proxy_url` / `https_proxy_url` in environment variables if you need proxying.

### **Summarization backends**

* **`first_n_chars`**

  *Purpose:* Generates chat titles by simply taking the first few characters (default 40) of the first user message, adding an ellipsis if needed.

  *Setup:* Set the SUMMARIZATION_BACKEND backend key to "first_n_chars". Backend works out of the box, no external dependencies or services required. Useful as a fallback if no summarization API is available.

### **Text-to-Image backends**

* **`dummy_image_generator`**

  *Purpose:* Generates deterministic identicon-style PNG thumbnails for chats, based on their titles or other strings.

  *Setup:* Set TEXT_TO_IMAGE_BACKEND to "dummy_image_generator". Works offline, no API keys needed. Generates 256×256px images with a symmetrical pattern and solid color derived from a hash of the input string.

### **RAG (Retrieval-Augmented Generation) backends**

* **`norag`**

  *Purpose:* Use it disable RAG functionality for the app

  *Setup:* Set RAG_BACKEND to "norag"

* **`simple_rag`**

  *Purpose:* Sends the user’s query to an external Retrieval-Augmented Generation (RAG) server and returns the server’s raw text response. Useful for integrating domain-specific knowledge sources.
  *Requirements:* A running HTTP-accessible RAG server that accepts the query as JSON.

  *Setup:*

  * Override RAG_BACKEND setting. Set name to "simple_rag". Then, configure the backend with the RAG server’s `url`, HTTP method (`post` or `get`), and the JSON field name under which the query prompt will be sent (default: `"prompt"`).
  * Example:
```
RAG_BACKEND = {
    "name": "simple",
    "kwargs": {
        "url": "http://172.17.0.1:8024/search",
        "method": "post",
        "paylod_key: "prompt"
    }
}
```


### **TTS (Text-to-Speech) backends**

* **`remote_tts`**

  *Purpose:* Calls a remote TTS service over HTTP to synthesize speech from text.
  *Requirements:* A running TTS server with two endpoints:

  * `/tts/` — accepts POST with JSON `{ "text": "...", "sample_name": "<voice>" }`, returns audio bytes.

  *Setup:*
  * Override TTS_BACKEND and set the name to "remote_tts"
  * Set `host`, `port`, and `default_voice` in backend configuration.
  * `use_tls` controls whether `https` or `http` is used.
  * Optional: configure `proxies` dict if calls should go through HTTP/S proxies.
  * Ensure the TTS service supports the expected endpoints and content types.
  * Example:
```
TTS_BACKEND = {
    "name": "remote_tts",
    "kwargs": { 
        "host": "172.17.0.1",
        "port": 10001,
        "default_voice": "main",
        "use_tls": False
    }
}
```

## Implementing and registering custom backends

You can provide your own backend class and register it with the appropriate registry.

**1) Recommended: register in your `AppConfig.ready()`**

```py
# django/assistant/apps.py
from django.apps import AppConfig

class MyAppConfig(AppConfig):
    name = "myapp"

    def ready(self):
        import assistant.tts_backends as tts_backends
        from myapp.custom_backends import MyTtsBackend
        tts_backends.backends["my_tts"] = MyTtsBackend
```

```py
# django/mysite/settings_local.py
TTS_BACKEND = {"name": "my_tts", "kwargs": {...}}
```

**2) Quick hack: edit `assistant/*_backends.py`**
Add your class directly to the file and extend the `backends` mapping.
Less upgrade-friendly, but simple.

# License

MIT