import unittest
from fastapi.testclient import TestClient
from app import app


component = """
function MainComponent(props) {
    return <div>Hello, world</div>;
}
"""

styles = """
body {
    color: red;
}
"""

buggy_component = """
function MainComponent(props) {
    return <div>Hello, world
}
"""

three_components = """
function First(props) {
    return <div>Hello</div>;
}

export const SecondOne = props => <div>World</div>;

function ThirdOne() {
    return <div>Hello, world</div>;
}
"""

code_without_component = """
function startsWithLowerCaseLetter(props) {
    return <div>Hello, world</div>;
}

export function sameIssue(props) {
    return <div>Hello, world</div>;
}
"""

class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_build_failes_because_of_wrong_data(self):
        response = self.client.post("/build-component/", json={ "source_tree": {"foo": "bar"} })
        self.assertEqual(422, response.status_code)

    def test_build_fails_because_of_malformed_source_tree_entry(self):
        data = {
            "source_tree": [{
                "file_path": "script.js"
            }]
        }

        response = self.client.post("/build-component/", json=data)
        self.assertEqual(400, response.status_code)
        self.assertEqual(f'Malformed file entry: missing required field "content"',
                         response.json()["detail"])

    def test_build_fails_without_source_files_provided(self):
        data = { "source_tree": [] }
        response = self.client.post("/build-component/", json=data)
        self.assertEqual(400, response.status_code)
        self.assertEqual("No source files provided", response.json()["detail"])

    def test_build_fails_without_javascript_file(self):
        data = {
            "source_tree": [{ "content": "body { color: red; }", "file_path": "styles.css"}],
        }
        response = self.client.post("/build-component/", json=data)
        self.assertEqual(400, response.status_code)
        self.assertEqual('Expected at least one file entry with ".js" extension', response.json()["detail"])

    def test_build_fails_with_empty_javascript_file(self):
        data = {
            "source_tree": [{ "content": "  ", "file_path": "script.js"}],
        }
        response = self.client.post("/build-component/", json=data)
        self.assertEqual(400, response.status_code)
        self.assertEqual(f'Found blank file: "script.js"', response.json()["detail"])

    def test_build_failes_due_to_bug_in_js_file(self):
        data = {
            "source_tree": [{
                "content": buggy_component,
                "file_path": "component.js"
            }]
        }

        response = self.client.post("/build-component/", json=data)
        self.assertEqual(200, response.status_code)
        response_json = response.json()
        self.assertFalse(response_json["success"])

    def test_build_failes_due_to_missing_components_in_js_file(self):
        data = {
            "source_tree": [{ "content": code_without_component, "file_path": "script.js"}],
        }
        response = self.client.post("/build-component/", json=data)
        self.assertEqual(400, response.status_code)
        self.assertEqual(f'Component not found in javascript code',
                         response.json()["detail"])

    def test_successful_build(self):
        data = {
            "source_tree": [{
                "content": component,
                "file_path": "component.js"
            }, {
                "content": styles,
                "file_path": "styles.css"
            }]
        }
        response = self.client.post("/build-component/", json=data)
        self.assertEqual(200, response.status_code)

        response_json = response.json()
        self.assertTrue(response_json["success"])

        files = sorted(list(response_json["artifacts"].keys()))

        self.assertEqual(["index.html", "main.css", "main.js"], files)

        self.assertIn("MainComponent", response_json["artifacts"]["main.js"])
        self.assertIn(styles, response_json["artifacts"]["main.css"])
        self.assertIn('href="main.css"', response_json["artifacts"]["index.html"])
        
    def test_successful_build_without_styles(self):
        data = {
            "source_tree": [{
                "content": component,
                "file_path": "component.js"
            }]
        }

        response = self.client.post("/build-component/", json=data)
        self.assertEqual(200, response.status_code)
        response_json = response.json()
        self.assertTrue(response_json["success"])
        files = sorted(list(response_json["artifacts"].keys()))
        self.assertEqual(["index.html", "main.css", "main.js"], files)
        self.assertIn("", response_json["artifacts"]["main.css"])

    def test_successful_build_with_multiple_components(self):
        data = {
            "source_tree": [{
                "content": three_components,
                "file_path": "component.js"
            }]
        }

        response = self.client.post("/build-component/", json=data)
        self.assertEqual(200, response.status_code)
        response_json = response.json()
        self.assertTrue(response_json["success"])
        files = sorted(list(response_json["artifacts"].keys()))
        self.assertEqual(["index.html", "main.css", "main.js"], files)

        self.assertIn("SecondOne", response_json["artifacts"]["main.js"])
        self.assertIn("", response_json["artifacts"]["main.css"])


if __name__ == '__main__':
    unittest.main()
