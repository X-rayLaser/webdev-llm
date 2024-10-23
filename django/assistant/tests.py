from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from .models import Server, Preset


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
