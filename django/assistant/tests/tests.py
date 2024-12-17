from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.utils import timezone

from assistant.models import (
    Configuration, Server, Preset, Build, LinterCheck, TestRun, OperationSuite, Revision,
    Thread, Comment, Chat, Modality, MultimediaMessage
)


class ServerAPITests(APITestCase):
    def setUp(self):
        self.server_data = {
            "name": "Test Server",
            "url": "http://localhost:8000",
            "description": "This is a test server.",
            "configuration": {"timeout": 30}
        }
        self.server = Server.objects.create(**self.server_data)
        self.url = reverse('server-list')

    def test_list_servers(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_server(self):
        new_server_data = {
            "name": "New Server",
            "url": "http://localhost:9000",
            "description": "Another test server.",
            "configuration": {"timeout": 50}
        }
        response = self.client.post(self.url, new_server_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Server.objects.count(), 2)

    def test_retrieve_server(self):
        response = self.client.get(reverse('server-detail', args=[self.server.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.server.name)

    def test_update_server(self):
        updated_data = {
            "name": "Updated Server",
            "url": "http://localhost:8001",
            "description": "Updated description.",
            "configuration": {"timeout": 60}
        }
        response = self.client.put(reverse('server-detail', args=[self.server.id]), updated_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.server.refresh_from_db()
        self.assertEqual(self.server.name, updated_data['name'])

    def test_delete_server(self):
        response = self.client.delete(reverse('server-detail', args=[self.server.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Server.objects.count(), 0)


class PresetAPITests(APITestCase):
    def setUp(self):
        self.preset_data = {
            "name": "Default Preset",
            "temperature": 0.7,
            "top_k": 50,
            "top_p": 0.9,
            "min_p": 0.1,
            "repeat_penalty": 1.2,
            "n_predict": 100,
            "extra_params": {"stop": ["\n\n"]}
        }
        self.preset = Preset.objects.create(**self.preset_data)
        self.url = reverse('preset-list')

    def test_list_presets(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_preset(self):
        new_preset_data = {
            "name": "New Preset",
            "temperature": 0.5,
            "top_k": 40,
            "top_p": 0.8,
            "min_p": 0.15,
            "repeat_penalty": 1.1,
            "n_predict": 150,
            "extra_params": {"stop": ["\n"]}
        }
        response = self.client.post(self.url, new_preset_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Preset.objects.count(), 2)

    def test_retrieve_preset(self):
        response = self.client.get(reverse('preset-detail', args=[self.preset.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.preset.name)

    def test_update_preset(self):
        updated_data = {
            "name": "Updated Preset",
            "temperature": 0.65,
            "top_k": 45,
            "top_p": 0.85,
            "min_p": 0.12,
            "repeat_penalty": 1.15,
            "n_predict": 120,
            "extra_params": {"stop": ["\n\n\n"]}
        }
        response = self.client.put(reverse('preset-detail', args=[self.preset.id]), updated_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.preset.refresh_from_db()
        self.assertEqual(self.preset.name, updated_data['name'])

    def test_delete_preset(self):
        response = self.client.delete(reverse('preset-detail', args=[self.preset.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Preset.objects.count(), 0)


class ConfigurationAPITests(APITestCase):
    def setUp(self):
        self.preset = Preset.objects.create(name="Test Preset", temperature=0.7, top_k=40,
                                            top_p=0.9, min_p=0.1, repeat_penalty=1.2, n_predict=50)
        self.llm_server = Server.objects.create(name="LLM Server", url="http://llm-server.com")
        self.build_server = Server.objects.create(name="Build Server", url="http://build-server.com")
        
        self.config = self.create_config_object("Test Configuration")
        self.url = reverse('configuration-list')

    def test_create_configuration(self):
        config_data = {
            "name": "Another Configuration",
            "preset": self.preset.name,
            "llm_server": self.llm_server.name,
            "build_servers": [self.build_server.name],
            "lint_servers": [],
            "test_servers": [],
            "interaction_servers": [],
            "autorun": False,
            "max_iterations": 1
        }
        response = self.client.post(self.url, config_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertEqual(Configuration.objects.count(), 2)

    def test_list_configurations(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_retrieve_configuration(self):
        response = self.client.get(reverse('configuration-detail', args=[self.config.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.config.name)

    def test_update_configuration(self):
        new_llm_server = Server.objects.create(name="Different LLM Server", url="http://llm.com")
        updated_data = {
            "name": "Updated Configuration",
            "preset": self.preset.name,
            "llm_server": new_llm_server.name,
            "build_servers": [self.build_server.name],
            "autorun": True,
            "max_iterations": 5
        }
        response = self.client.patch(reverse('configuration-detail', args=[self.config.id]),
                                     updated_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.config.refresh_from_db()
        self.assertEqual(self.config.name, updated_data['name'])
        self.assertEqual(self.config.autorun, updated_data['autorun'])
        self.assertEqual(self.config.llm_server.name, updated_data['llm_server'])

    def test_delete_configuration(self):
        response = self.client.delete(reverse('configuration-detail', args=[self.config.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Configuration.objects.count(), 0)

    def create_config_object(self, name):
        config = Configuration.objects.create(
            name=name,
            preset=self.preset,
            llm_server=self.llm_server,
        )
        config.build_servers.add(self.build_server)
        return config


class OperationDetailTests(APITestCase):
    def setUp(self):
        self.build = Build.objects.create(logs={"info": "Build log"}, url="http://build.com")
        self.linter_check = LinterCheck.objects.create(logs={"info": "Linter log"}, report={"errors": []})
        self.test_run = TestRun.objects.create(logs={"info": "Test log"}, report={"passed": True})

    def test_get_build_detail(self):
        url = reverse('build-detail', args=[self.build.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['logs'], self.build.logs)

    def test_get_linter_check_detail(self):
        url = reverse('lintercheck-detail', args=[self.linter_check.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['logs'], self.linter_check.logs)

    def test_get_test_run_detail(self):
        url = reverse('testrun-detail', args=[self.test_run.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['logs'], self.test_run.logs)

    def test_with_hardcoded_url(self):
        response = self.client.get("/api/builds/1/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['logs'], self.build.logs)


class OperationSuiteAPITests(APITestCase):
    def setUp(self):
        modality = Modality.objects.create(modality_type="text")
        message = MultimediaMessage.objects.create(content=modality)
        self.revision = Revision.objects.create(src_tree={}, message=message)
        self.suite = OperationSuite.objects.create(revision=self.revision)

        # Create operations in all states for each type
        self.builds = self.create_operations(Build)
        self.lints = self.create_operations(LinterCheck)
        self.tests = self.create_operations(TestRun)

        self.list_url = reverse('operation-suite-list')
        self.url = reverse('operation-suite-detail', args=[self.suite.id])

    def create_operations(self, model_class):
        def create_fn(**kwargs):
            return model_class.objects.create(**kwargs)

        return [
            create_fn(operation_suite=self.suite, finished=True, success=True),
            create_fn(operation_suite=self.suite, finished=True, success=False, errors={"error": "Crashed"}),
            create_fn(operation_suite=self.suite, finished=True, success=False),
            create_fn(operation_suite=self.suite, finished=False)
        ]

    def test_list_operation_suites(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_retrieve_operation_suite(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('builds', data)
        self.assertIn('lints', data)
        self.assertIn('tests', data)

    def test_operation_suite_detail(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        groups = ["builds", "lints", "tests"]
        statuses = ['successful', 'crashed', 'failed', 'running']

        for group in groups:
            operation_objects = getattr(self, group)
            with self.subTest(group):
                group_data = response.data[group]

                operation_objects = getattr(self, group)
                for state, obj in zip(statuses, operation_objects):
                    self.assertIn("http://testserver" + obj.get_absolute_url(), group_data[state])


class ThreadAPITests(APITestCase):
    def setUp(self):
        modality = Modality.objects.create(modality_type="text")

        message = MultimediaMessage.objects.create(content=modality)
        self.revision = Revision.objects.create(src_tree={}, message=message)
        
        # Create comments and threads with branching
        self.thread = Thread.objects.create(
            revision=self.revision,
            file_path="example.py",
            line_no=42,
            timestamp=timezone.now()
        )

        self.head_comment = Comment.objects.create(text="Initial Comment", thread=self.thread)
        
        # Add branching comments
        self.child_comment_1 = Comment.objects.create(text="First Reply", parent=self.head_comment)
        self.child_comment_2 = Comment.objects.create(text="Second Reply", parent=self.head_comment)
        self.child_comment_1_1 = Comment.objects.create(text="Reply to First Reply", parent=self.child_comment_1)

        self.thread_detail_url = reverse('thread-detail', args=[self.thread.id])

    def test_retrieve_thread_with_comment_tree(self):
        response = self.client.get(self.thread_detail_url)
        self.assertEqual(response.status_code, 200)
        
        data = response.data
        self.assertIn('comment_tree', data)
        
        # Check root level
        self.assertEqual(data['comment_tree'][0]['text'], "Initial Comment")
        
        # Check first-level replies
        replies = data['comment_tree'][0]['replies']
        self.assertEqual(replies[0]['text'], "First Reply")
        self.assertEqual(replies[1]['text'], "Second Reply")
        
        # Check nested reply
        self.assertEqual(replies[0]['replies'][0]['text'], "Reply to First Reply")


class ChatAPITests(APITestCase):
    def setUp(self):
        # Create instances of Server and Preset with necessary fields
        self.server = Server.objects.create(name='Test Server', url='http://testserver.com')
        
        # Include all required fields for the Preset model
        self.preset = Preset.objects.create(
            name='Test Preset',
            temperature=0.7,
            top_k=50,
            top_p=0.9,
            min_p=0.1,
            repeat_penalty=1.2,
            n_predict=5,
            extra_params={"param1": "value1"}
        )

        # Create a Configuration instance with the required fields
        self.configuration = Configuration.objects.create(
            name='Test Configuration',
            llm_server=self.server,
            preset=self.preset
        )

        # Create a Chat instance
        self.chat = Chat.objects.create(
            name="Test Chat",
            description="A test chat",
            configuration=self.configuration
        )
        
        self.list_url = reverse('chat-list')
        self.url = reverse('chat-detail', args=[self.chat.id])

    def test_list_chats(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json()["results"], list)

    def test_retrieve_chat(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        expected_configuration_url = reverse('configuration-detail', args=[self.configuration.id])
        full_expected_configuration_url = response.wsgi_request.build_absolute_uri(expected_configuration_url)

        self.assertEqual(data['configuration'], full_expected_configuration_url)

        self.assertEqual(data['name'], self.chat.name)
        self.assertEqual(data['description'], self.chat.description)
        self.assertIn('messages', data)

    def test_create_chat(self):
        data = {
            'name': 'New Chat',
            'description': 'This is a new chat.',
            'configuration': reverse('configuration-detail', args=[self.configuration.id])
        }
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Chat.objects.count(), 2)  # One existing chat + one new
        self.assertEqual(Chat.objects.last().name, 'New Chat')

    def test_update_chat(self):
        data = {
            'name': 'Updated Chat',
            'description': 'This is an updated chat.',
            'configuration': reverse('configuration-detail', args=[self.configuration.id])
        }
        response = self.client.put(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh the instance from the database
        self.chat.refresh_from_db()
        self.assertEqual(self.chat.name, 'Updated Chat')
        self.assertEqual(self.chat.description, 'This is an updated chat.')

    def test_delete_chat(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Chat.objects.count(), 0)  # Chat should be deleted


class MultimediaMessageAPITests(APITestCase):
    def setUp(self):
        #self.revision = Revision.objects.create(src_tree={})
        self.configuration = Configuration.objects.create(
            name="Test Config",
            llm_server=Server.objects.create(name="Test Server", url="http://localhost:8000"),
            preset=Preset.objects.create(
                name="Default",
                temperature=0.7,
                top_k=50,
                top_p=0.9,
                min_p=0.1,
                repeat_penalty=1.0,
                n_predict=1,
                extra_params=None
            )
        )
        self.chat = Chat.objects.create(name="Test Chat", configuration=self.configuration)

        self.modality = Modality.objects.create(modality_type="text")

        self.request_data = {
            "role": "user",
            "chat": self.chat.id,
            "parent": None,
            "content": self.modality.id
        }
        self.message_data = {
            "role": "user",
            "chat": self.chat,
            "parent": None,
            "content": self.modality
        }
        self.message_url = "/api/multimedia-messages/"

    def _test_create_multimedia_message(self):
        # todo: fix the test
        response = self.client.post(self.message_url, self.request_data, format='json')
        print(response.json())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MultimediaMessage.objects.count(), 1)

    def test_list_multimedia_messages(self):
        MultimediaMessage.objects.create(**self.message_data)
        response = self.client.get(self.message_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_retrieve_multimedia_message(self):
        message = MultimediaMessage.objects.create(**self.message_data)
        url = f"{self.message_url}{message.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], message.id)

    def test_update_multimedia_message(self):
        message = MultimediaMessage.objects.create(**self.message_data)
        url = f"{self.message_url}{message.id}/"
        updated_data = {"role": "assistant"}
        response = self.client.patch(url, updated_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message.refresh_from_db()
        self.assertEqual(message.role, "assistant")
