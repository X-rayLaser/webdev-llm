from django.urls import reverse


def create_default_preset_data(preset_name='SamplePreset'):
    return {
        'name': preset_name,
        'temperature': 0.7,
        'top_k': 40,
        'top_p': 0.9,
        'min_p': 0.1,
        'repeat_penalty': 1.2,
        'n_predict': 5,
        'extra_params': {"param1": "value1"}
    }


def create_default_preset(client, name):
    return client.post(reverse('preset-list'),
                       create_default_preset_data(name),
                       format='json')


def create_server(client, name, url='http://localhost:8000', description='LLM server'):
    return client.post(reverse('server-list'), {
        'name': name,
        'url': url,
        'description': description,
    })


def create_default_conf(client, name='MainConfig',
                        preset_name='SamplePreset', llm_server='LLM server'):
    return client.post(reverse('configuration-list'), {
        'name': name,
        'preset': preset_name,
        'llm_server': llm_server
    })


def create_chat(client, config_id, name='First chat'):
    config_url = reverse('configuration-detail', args=[config_id])

    return client.post(reverse('chat-list'), {
        'name': name,
        'configuration': config_url,
        # Add other necessary fields if required...
    })


def create_modality(client, **kwargs):
    return client.post(reverse('modality-list'), kwargs)


def create_text_modality(client, text, parent=None):
    kwargs = dict(modality_type="text", text=text)
    if parent:
        kwargs["mixed_modality"] = parent
    return create_modality(client, **kwargs)


def create_code_modality(client, file_path, parent=None):
    kwargs = dict(modality_type="code", file_path=file_path)
    if parent:
        kwargs["mixed_modality"] = parent

    return create_modality(client, **kwargs)


def create_mixed_modality(client, layout, parent=None):
    kwargs = dict(modality_type="mixed", layout=layout)
    if parent:
        kwargs["mixed_modality"] = parent
    return create_modality(client, **kwargs)


def create_message(client, modality_id, chat_id=None, parent_id=None, role="user", src_tree=None):
    data = {
        'role': role,
        'content': modality_id
    }

    if src_tree:
        data['src_tree'] = src_tree
    
    if chat_id is not None:
        data['chat'] = chat_id

    if parent_id is not None:
        data['parent'] = parent_id

    return client.post(reverse('multimediamessage-list'), data, format='json')