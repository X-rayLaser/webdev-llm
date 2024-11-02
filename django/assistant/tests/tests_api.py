from rest_framework.test import APITestCase
from assistant.tests import utils
from django.urls import reverse
from io import BytesIO


class ModalityOrderingTests(APITestCase):
    def test_initial_ordering(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        response, child_ordering = self.get_child_modalities_ordering(mixed_modality_id)

        self.assertEqual([(text_modality_id, 1), (code_modality_id, 2)], child_ordering, response.json())
        response, child_ids = self.get_child_modalities_ids(mixed_modality_id)
        self.assertEqual([text_modality_id, code_modality_id], child_ids, response.json())

    def test_change_ordering(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)

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
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id, text_modality_id]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_send_partial_ordering_for_child_modalities(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_send_ids_of_child_modalities_of_different_parent(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        mixed_modality_id2, text_modality_id2, code_modality_id2 = create_modalities(self.client)

        reorder_url = reverse("modality-reorder", args=[mixed_modality_id])
        response = self.client.post(reorder_url, {
            "modalities": [text_modality_id, code_modality_id2]
        }, format="json")
        self.assertEqual(400, response.status_code, response.data)

    def test_cannot_change_ordering_of_concrete_leaf_modality(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)

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


class UpdateModalityTests(APITestCase):
    def test_cannot_update_code_modality(self):
        chat = utils.create_default_chat(self.client)

        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        src_tree = [{"path": "/path/to/code_file.py", "content": "print()"}]
        utils.create_message(self.client, mixed_modality_id,
                             chat_id=chat, src_tree=src_tree)

        response = self.client.patch(reverse("modality-detail", args=[code_modality_id]), {
            "file_path": "/codefile.py"
        })

        self.assertEqual(400, response.status_code, response.json())

    def test_can_update_text_modality(self):
        mixed_modality_id, text_modality_id, code_modality_id = create_modalities(self.client)
        response = self.client.patch(reverse("modality-detail", args=[text_modality_id]), {
            "text": "New text"
        })

        self.assertEqual(200, response.status_code)
        response = self.client.get(reverse("modality-detail", args=[text_modality_id]))
        self.assertEqual("New text", response.data["text"])

    def test_can_update_image_modality(self):
        response1 = self.client.post(reverse("modality-list"), {
            "modality_type": "image"
        })
        self.assertEqual(201, response1.status_code)
        

        modality_id = response1.data["id"]

        img = BytesIO(
            b"GIF89a\x01\x00\x01\x00\x00\x00\x00!\xf9\x04\x01\x00\x00\x00"
            b"\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x01\x00\x00"
        )
        img.name = "myimage.gif"
        response2 = self.client.patch(reverse("modality-detail", args=[modality_id]), {
            "image": img
        })
        self.assertEqual(200, response2.status_code)
        self.assertIsNotNone(response2.data["image"])

    def test_can_only_update_layout_of_mixed_modality(self):
        mixed_modality_response = utils.create_mixed_modality(self.client, layout_type='vertical')
        mixed_modality_id = mixed_modality_response.data['id']

        response1 = self.client.patch(reverse("modality-detail", args=[mixed_modality_id]), {
            "layout": {"type": "horizontal"}
        }, format="json")
        self.assertEqual(200, response1.status_code)
        self.assertEqual({"type": "horizontal"}, response1.data["layout"])

        response2 = self.client.patch(reverse("modality-detail", args=[mixed_modality_id]), {
            "modality_type": "image"
        }, format="json")

        self.assertEqual(400, response2.status_code)

    def test_cannot_update_certain_fields(self):
        text_modality_response = utils.create_text_modality(
            self.client, text="This is a text modality"
        )
        modality_id = text_modality_response.data["id"]

        response1 = self.client.patch(reverse("modality-detail", args=[modality_id]), {
            "modality_type": "image"
        }, format="json")

        self.assertEqual(400, response1.status_code)

    def test_can_only_update_text_on_text_modality(self):
        text_modality_response = utils.create_text_modality(
            self.client, text="This is a text modality"
        )
        text_modality_id = text_modality_response.data["id"]

        image_modality_response = self.client.post(reverse("modality-list"), {
            "modality_type": "image"
        })
        image_modality_id = image_modality_response.data["id"]

        code_modality_response = self.client.post(reverse("modality-list"), {
            "modality_type": "code",
            "file_path": "main.js"
        })
        code_modality_id = code_modality_response.data["id"]

        mixed_mod_response = utils.create_mixed_modality(self.client, layout_type="horizontal")
        mixed_modality_id = mixed_mod_response.data["id"]

        img = BytesIO(
            b"GIF89a\x01\x00\x01\x00\x00\x00\x00!\xf9\x04\x01\x00\x00\x00"
            b"\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x01\x00\x00"
        )
        img.name = "myimage.gif"
        updates = {
            "text": ("New text", dict(format="json")),
            "image": (img, {}),
            "file_path": (img, dict(format="json")),
            "layout": ("vertical", dict(format="json"))
        }

        cases = {
            "can_only_update_text_on_text_modality": (text_modality_id, exclude_field(updates, "text")),
            "can_only_update_image_on_image_modality": (image_modality_id, exclude_field(updates, "image")),
            "can_only_update_file_path_on_code_modality": (code_modality_id, exclude_field(updates, "file_path")),
            "can_only_update_layout_on_mixed_modality": (mixed_modality_id, exclude_field(updates, "layout"))
        }

        for case, (mod_id, submissions) in cases.items():
            with self.subTest(case):
                for field, (value, submission_kwargs) in submissions.items():
                    response = self.client.patch(reverse("modality-detail", args=[mod_id]), {
                        field: value
                    }, **submission_kwargs)

                    self.assertEqual(400, response.status_code)


def exclude_field(mapping, field):
    mapping = dict(mapping)
    del mapping[field]
    return mapping


def create_modalities(client):
    mixed_modality_response = utils.create_mixed_modality(client, layout_type='vertical')
    mixed_modality_id = mixed_modality_response.data['id']

    text_modality_response = utils.create_text_modality(
        client, text="This is a text modality", parent=mixed_modality_id)
    text_modality_id = text_modality_response.data['id']
    
    code_modality_response = utils.create_code_modality(
        client, file_path="/path/to/code_file.py", parent=mixed_modality_id)
    code_modality_id = code_modality_response.data['id']
    return mixed_modality_id, text_modality_id, code_modality_id
