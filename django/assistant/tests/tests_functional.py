from rest_framework.test import APITestCase
from django.urls import reverse
from assistant.tests import utils


class MainScenarioTest(APITestCase):
    def test_configuration_creation_and_chat_interaction(self):
        # Step 1: Create a Preset
        preset_name = 'SamplePreset'
        preset_response = utils.create_default_preset(self.client, preset_name)
        self.assertEqual(preset_response.status_code, 201)
        preset_id = preset_response.data['id']
        
        # Step 2: Create several Server instances
        build_server_response = utils.create_server(self.client, name='BuildServer1')
        self.assertEqual(build_server_response.status_code, 201)
        build_server_id = build_server_response.data['id']

        llm_server_name = 'LLM server'
        llm_server_response = utils.create_server(self.client, name=llm_server_name)
        self.assertEqual(llm_server_response.status_code, 201)
        llm_server_id = llm_server_response.data['id']
        
        # Repeat for other server types (lint, test, interaction) as necessary
        
        # Step 3: Create a Configuration and link the Preset and Servers
        config_response = utils.create_default_conf(self.client, name='MainConfig', 
                                                    preset_name=preset_name,
                                                    llm_server=llm_server_name)
        self.assertEqual(config_response.status_code, 201)
        config_id = config_response.data['id']
        
        # Step 4: Create a Chat
        chat_response = utils.create_chat(self.client, config_id, name='First chat')
        self.assertEqual(chat_response.status_code, 201, chat_response.json())
        chat_id = chat_response.data['id']
        
        # Step 5: Create the first Message in the Chat
        modality1_response = utils.create_text_modality(self.client,
                                                        text="This is the first message.")

        modality1_id = modality1_response.data['id']
        message1_response = utils.create_message(self.client, modality_id=modality1_id,
                                                 chat_id=chat_id, role="user")

        self.assertEqual(message1_response.status_code, 201, message1_response.json())
        message1_id = message1_response.data['id']
        
        # Step 6: Create the second Message in the Chat
        modality2_response = utils.create_code_modality(self.client, file_path="main.js")

        modality2_id = modality2_response.data['id']
        message2_response = utils.create_message(
            self.client,
            modality_id=modality2_id,
            parent_id=message1_id,
            role="assistant",
            src_tree=[{"file_path": "main.js", "content": "console.log(42)"}]
        )
        self.assertEqual(message2_response.status_code, 201, message2_response.json())
        message2_id = message2_response.data['id']
        
        # Step 7: Create a Revision based on the chat messages

        revision_response = self.client.post(reverse('multimediamessage-make-revision'), {
            'src_tree': [{"file_path": "main.js", "content": "console.log(0)"}],
            'message': message2_id,
            # Other fields if necessary
        }, format='json')
        self.assertEqual(revision_response.status_code, 201, revision_response.json())
        revision_id = revision_response.data['id']

        # Step 8: Create a thread of comments for a particular file revision

        thread_response = self.client.post(reverse('thread-list'), {
            'revision': revision_id,
            'file_path': "main.js",
            # Other fields if necessary
        }, format='json')
        self.assertEqual(thread_response.status_code, 201, thread_response.json())
        thread_id = thread_response.data['id']

        # Step 9: Add a Comment to the Revision
        comment_response = self.client.post(reverse('comment-list'), {
            'thread': thread_id,
            'text': 'This is a comment on the revision.',
        })
        self.assertEqual(comment_response.status_code, 201)
        comment_id = comment_response.data['id']
        
        # Step 10: Add a Response to the Comment
        response_comment = self.client.post(reverse('comment-list'), {
            'parent': comment_id,
            'text': 'This is a response to the initial comment.',
        })
        self.assertEqual(response_comment.status_code, 201)
        
        # Optional Assertions: check if all elements were correctly linked
        # Additional checks could verify relationships or specific content fields if needed
