from rest_framework.test import APITestCase
from assistant.tests import utils
from django.urls import reverse


class ModalityOrderingTests(APITestCase):
    def test_initial_ordering(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()
        response, child_ordering = self.get_child_modalities_ordering(mixed_modality_id)

        self.assertEqual([(text_modality_id, 1), (code_modality_id, 2)], child_ordering, response.json())
        response, child_ids = self.get_child_modalities_ids(mixed_modality_id)
        self.assertEqual([text_modality_id, code_modality_id], child_ids, response.json())

    def test_change_ordering(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()

        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [code_modality_id, text_modality_id]
        }, format="json")
        self.assertEqual(204, response.status_code, response.status_code)

        response, child_ordering = self.get_child_modalities_ordering(mixed_modality_id)
        self.assertEqual([(code_modality_id, 1), (text_modality_id, 2)], child_ordering, response.json())

        response, child_ids = self.get_child_modalities_ids(mixed_modality_id)
        self.assertEqual([code_modality_id, text_modality_id], child_ids, response.json())

    def test_cannot_post_duplicate_ids(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()
        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id, text_modality_id]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_send_partial_ordering_for_child_modalities(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()
        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_send_ids_of_child_modalities_of_different_parent(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()
        mixed_modality_id2, text_modality_id2, code_modality_id2 = self.create_modalities()

        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id, code_modality_id2]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_change_ordering_of_concrete_leaf_modality(self):
        mixed_modality_id, text_modality_id, code_modality_id = self.create_modalities()

        reorder_url = reverse("modality-reorder", args=[text_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id, code_modality_id]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def get_child_modalities_ids(self, mixed_modality_id):
        url = reverse("modality-detail", args=[mixed_modality_id])
        response = self.client.get(url)
        return response, [obj["id"] for obj in response.data["mixture"]]

    def get_child_modalities_ordering(self, mixed_modality_id):
        url = reverse("modality-detail", args=[mixed_modality_id])
        response = self.client.get(url)
        return response, [(obj["id"], obj["order"]) for obj in response.data["mixture"]]

    def create_modalities(self):
        mixed_modality_response = utils.create_mixed_modality(self.client, layout_type='vertical')
        self.assertEqual(mixed_modality_response.status_code, 201, mixed_modality_response.json())
        mixed_modality_id = mixed_modality_response.data['id']

        text_modality_response = utils.create_text_modality(
            self.client, text="This is a text modality", parent=mixed_modality_id)
        self.assertEqual(text_modality_response.status_code, 201)
        text_modality_id = text_modality_response.data['id']
        
        code_modality_response = utils.create_code_modality(
            self.client, file_path="/path/to/code_file.py", parent=mixed_modality_id)
        self.assertEqual(code_modality_response.status_code, 201)
        code_modality_id = code_modality_response.data['id']
        return mixed_modality_id, text_modality_id, code_modality_id