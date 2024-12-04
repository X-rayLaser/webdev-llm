from io import BytesIO
from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from assistant.tests import utils
from assistant.models import Generation, Chat


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


class CreateMessageTests(APITestCase):
    def test_creating_message_with_code(self):
        response = utils.create_code_modality(self.client, file_path="main.js")
        code_mod_id = response.data["id"]

        chat_id = utils.create_default_chat(self.client)

        cases = {
            "creating message without sending files": None,
            "sending files as dict": {"file_path": "whatever"},
            "sending files as list of strings": ["whatever"],
            "sending files with none of required keys": [{"file": "123"}],
            "sending files with only content key": [{"content": "123"}],
            "sending files with with only file_path key": [{"file_path": "main.js"}],
            "creating message with malformed source files": [{"file_path": "whatever"}],
            "creating message with wrong file in the source files": [{"file_path": "root.js", "content": ""}]
        }

        for case, src_tree in cases.items():
            with self.subTest(case):
                response = utils.create_message(self.client, code_mod_id, 
                                                chat_id=chat_id, src_tree=src_tree)
                self.assertEqual(400, response.status_code)

    def test_creating_message_with_multiple_code_sections_and_files(self):
        response = utils.create_mixed_modality(self.client, layout_type="grid")
        mixed_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="main.js", parent=mixed_id)
        main_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="utils.js", parent=mixed_id)
        utils_id = response.data["id"]

        chat_id = utils.create_default_chat(self.client)

        # some files are missing
        response = utils.create_message(self.client, mixed_id, chat_id=chat_id,
                                        src_tree=[{"file_path": "main.js", "content": "content"}])
        self.assertEqual(400, response.status_code)

        # one file has wrong name
        src_tree = [{"file_path": "main.js", "content": "content"},
                    {"file_path": "config.js", "content": "let x;"}]
        response = utils.create_message(self.client, mixed_id, chat_id=chat_id, src_tree=src_tree)
        self.assertEqual(400, response.status_code)

    def test_create_message_with_nested_code_modality(self):
        response = utils.create_mixed_modality(self.client, layout_type="grid")
        mixed_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="main.js", parent=mixed_id)
        main_id = response.data["id"]

        chat_id = utils.create_default_chat(self.client)
        response = utils.create_message(self.client, mixed_id, chat_id=chat_id,
                                        src_tree=[{"file_path": "main.js", "content": "x = 2"}])

        data = response.data
        revisions = data["revisions"]
        self.assertEqual(1, len(revisions))
        rev = revisions[0]
        self.assertEqual([{"file_path": "main.js", "content": "x = 2"}], rev["src_tree"])
        self.assertEqual(rev["id"], data["active_revision"])

    def test_can_view_created_message_containing_code(self):

        chat_id = utils.create_default_chat(self.client)
        response = utils.create_text_modality(self.client, text="First msg")
        mod_id = response.data["id"]
        response = utils.create_message(self.client, mod_id, chat_id=chat_id)
        first_msg_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="main.js")
        main_id = response.data["id"]

        response = utils.create_message(self.client, main_id, parent_id=first_msg_id,
                                        src_tree=[{"file_path": "main.js", "content": "x = 2"}])
        second_msg_id = response.data["id"]
        resp = self.client.get(f"/api/multimedia-messages/{first_msg_id}/")
        self.assertEqual(200, resp.status_code)

    def test_creating_message_with_nested_mixtures(self):
        response = utils.create_mixed_modality(self.client, layout_type="grid")
        top_mixture_id = response.data["id"]
        response = utils.create_mixed_modality(self.client, layout_type="grid",
                                               parent=top_mixture_id)
        nested_mixture_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="main.js",
                                              parent=nested_mixture_id)
        main_id = response.data["id"]

        response = utils.create_code_modality(self.client, file_path="utils.js",
                                              parent=top_mixture_id)
        utils_id = response.data["id"]
        chat_id = utils.create_default_chat(self.client)
        # some files are missing
        response = utils.create_message(self.client, top_mixture_id, chat_id=chat_id,
                                        src_tree=[{"file_path": "utils.js", "content": "content"}])
        self.assertEqual(400, response.status_code)


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

    def test_can_only_update_specific_fields_on_each_modality_type(self):
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


class GenerationCreationTests(APITestCase):

    def setUp(self):
        # Set up a chat and message for tests
        self.chat_id = utils.create_default_chat(self.client)
        self.chat = Chat.objects.get(id=self.chat_id)

        text_modality_response = utils.create_text_modality(
            self.client, text="This is a text modality"
        )
        text_modality_id = text_modality_response.data["id"]
        message_response = utils.create_message(
            self.client, modality_id=text_modality_id, chat_id=self.chat_id
        )
        self.message_id = message_response.data["id"]

    def test_create_generation_with_chat_only(self):
        """Ensure generation can be created with only a chat provided."""
        data = {
            "chat": self.chat_id,
            "model_name": "test-model",
            "params": {"param1": "value1"}
        }
        response = self.client.post(reverse('generation-list'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Generation.objects.filter(chat=self.chat).exists())
        self.assertEqual(response.data['chat'], data['chat'])

    def test_create_generation_with_message_only(self):
        """Ensure generation can be created with only a message provided."""
        data = {
            "message": self.message_id,
            "model_name": "test-model",
            "params": {"param1": "value1"}
        }
        response = self.client.post(reverse('generation-list'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Generation.objects.filter(message_id=self.message_id).exists())
        self.assertEqual(response.data['message'], data['message'])

    def test_create_generation_with_both_chat_and_message(self):
        """Ensure generation creation fails if both chat and message are provided."""
        data = {
            "chat": self.chat_id,
            "message": self.message_id,
            "model_name": "test-model",
            "params": {"param1": "value1"}
        }
        response = self.client.post(reverse('generation-list'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Exactly one of 'chat' or 'message' must be provided.",
                      response.data['non_field_errors'])

    def test_create_generation_with_neither_chat_nor_message(self):
        """Ensure generation creation fails if neither chat nor message is provided."""
        data = {
            "model_name": "test-model",
            "params": {"param1": "value1"}
        }
        response = self.client.post(reverse('generation-list'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Exactly one of 'chat' or 'message' must be provided.",
                      response.data['non_field_errors'])

    def test_create_generation_without_model_name_or_params(self):
        """Test creation with minimal data (only chat or message), ensuring defaults are handled."""
        data = {
            "chat": self.chat_id
        }
        response = self.client.post(reverse('generation-list'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Generation.objects.filter(chat=self.chat).exists())
        self.assertEqual(response.data['chat'], self.chat_id)


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
