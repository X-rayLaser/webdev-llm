import unittest
from fastapi.testclient import TestClient

from main import (
    preprocess, clear_imports, app, NoSourceFilesError, NoJsCodeError,
    EmptyJavascriptFileError, MalformedFileEntryError
)


class TestPreprocess(unittest.TestCase):

    def test_empty_source_tree_raises_no_source_files_error(self):
        """Test that an empty source_tree raises NoSourceFilesError."""
        source_tree = []
        with self.assertRaises(NoSourceFilesError):
            preprocess(source_tree)

    def test_no_javascript_file_raises_no_js_code_error(self):
        """Test that source_tree without a JavaScript file raises NoJsCodeError."""
        source_tree = [
            { "content": "body { color: red; }", "file_path": "style.css" },
            { "content": "<html><body></body></html>", "file_path": "index.html" }
        ]
        with self.assertRaises(NoJsCodeError):
            preprocess(source_tree)

    def test_empty_javascript_file_raises_empty_javascript_file_error(self):
        """Test that a source_tree with an empty JavaScript file raises EmptyJavascriptFileError."""
        source_tree = [
            { "content": " ", "file_path": "script.js" },
            { "content": "body { color: blue; }", "file_path": "style.css" }
        ]
        with self.assertRaises(EmptyJavascriptFileError):
            preprocess(source_tree)

    def test_missing_fields_raises_malformed_file_entry_error(self):
        """Test that a file missing 'content' or 'file_path' raises MalformedFileEntryError."""
        # Missing 'content' field
        source_tree_missing_content = [
            { "file_path": "script.js" },
            { "content": "body { color: red; }", "file_path": "style.css" }
        ]
        with self.assertRaises(MalformedFileEntryError):
            preprocess(source_tree_missing_content)

        # Missing 'file_path' field
        source_tree_missing_file_path = [
            { "content": "console.log('Hello');" },
            { "content": "body { color: red; }", "file_path": "style.css" }
        ]
        with self.assertRaises(MalformedFileEntryError):
            preprocess(source_tree_missing_file_path)

    def test_valid_source_tree_returns_expected_results(self):
        """Test that valid source_tree with one JS and one CSS file returns expected JavaScript and CSS."""
        source_tree = [
            { "content": "console.log('Hello World');", "file_path": "script.js" },
            { "content": "body { background-color: black; }", "file_path": "style.css" }
        ]

        expected_js = 'import "./style.css";\n' + "console.log('Hello World');"
        expected_css = "body { background-color: black; }"

        result_js, result_css, js_path, css_path = preprocess(source_tree)
        
        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)
        self.assertEqual(js_path, "script.js")
        self.assertEqual(css_path, "style.css")

    def test_source_tree_with_no_css_file_returns_empty_string_for_css(self):
        """Test that source_tree with a JS file but no CSS file returns empty string for CSS."""
        source_tree = [
            { "content": "console.log('Hello World');", "file_path": "script.js" }
        ]

        expected_js = "console.log('Hello World');"
        expected_css = ""  # No CSS file, so CSS output should be an empty string

        result_js, result_css, js_path, css_path = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)
        self.assertEqual(css_path, "")

    def test_source_tree_with_multiple_js_files_returns_first_js(self):
        """Test that source_tree with multiple JS files returns content of the first JS file."""
        source_tree = [
            { "content": "console.log('First JS');", "file_path": "script1.js" },
            { "content": "console.log('Second JS');", "file_path": "script2.js" },
            { "content": "console.log('Third JS');", "file_path": "script3.js" },
            { "content": "body { background-color: black; }", "file_path": "style.css" }
        ]

        expected_js = 'import "./style.css";\n' + "console.log('First JS');"
        expected_css = "body { background-color: black; }"

        result_js, result_css, *rest = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)  # Should return the first JS file
        self.assertEqual(result_css, expected_css)

    def test_source_tree_with_multiple_css_files_returns_first_css(self):
        """Test that source_tree with multiple CSS files returns content of the first CSS file."""
        source_tree = [
            { "content": "console.log('JS Code');", "file_path": "script.js" },
            { "content": "body { background-color: black; }", "file_path": "style1.css" },
            { "content": "body { color: red; }", "file_path": "style2.css" },
            { "content": "body { font-size: 16px; }", "file_path": "style3.css" }
        ]

        expected_js = 'import "./style1.css";\n' + "console.log('JS Code');"
        expected_css = "body { background-color: black; }"  # First CSS file

        result_js, result_css, js_path, css_path = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)  # Should return the first CSS file
        self.assertEqual(css_path, "style1.css")

    def test_add_missing_import_for_css_in_js_file(self):
        """Test that the function adds a missing import statement for CSS files to the JavaScript content."""
        source_tree = [
            { "content": 'console.log("Hello World");', "file_path": "script.js" },
            { "content": "body { background-color: black; }", "file_path": "some_style.css" }
        ]

        expected_js = 'import "./some_style.css";\nconsole.log("Hello World");'  # CSS import should be added
        expected_css = "body { background-color: black; }"

        result_js, result_css, *rest = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)

    def test_existing_import_for_css_does_not_add_duplicate(self):
        """Test that the function does not add a duplicate import statement for CSS files already imported in JavaScript."""
        source_tree = [
            { "content": 'import "./some_style.css";\nconsole.log("Hello World");', "file_path": "script.js" },
            { "content": "body { background-color: black; }", "file_path": "some_style.css" }
        ]

        expected_js = 'import "./some_style.css";\nconsole.log("Hello World");'  # No duplicate import should be added
        expected_css = "body { background-color: black; }"

        result_js, result_css, *rest = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)  # Should remain unchanged
        self.assertEqual(result_css, expected_css)

    def test_existing_import_in_single_quotes_for_css_does_not_add_duplicate(self):
        """The existing import statetemt is using single quotes rather than double quotes"""
        source_tree = [
            { "content": "import './some_style.css';\nconsole.log('Hello World');", "file_path": "script.js" },
            { "content": "body { background-color: black; }", "file_path": "some_style.css" }
        ]

        # No duplicate import should be added
        expected_js = "import './some_style.css';\nconsole.log('Hello World');"
        expected_css = "body { background-color: black; }"

        result_js, result_css, *rest = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)  # Should remain unchanged
        self.assertEqual(result_css, expected_css)

    def test_js_file_imports_css_not_in_source_tree_leaves_imports_unchanged(self):
        """Test that the function leaves existing import statements for CSS files unchanged
        if they are not present in source_tree."""
        source_tree = [
            {
                "content": 'import "./style1.css";\nimport "./style2.css";\nconsole.log("Hello World");',
                "file_path": "script.js"
            }
            # No actual CSS files in the source_tree
        ]

        # No changes expected
        expected_js = 'import "./style1.css";\nimport "./style2.css";\nconsole.log("Hello World");'
        expected_css = ""  # No CSS file in source_tree, so this should be empty

        result_js, result_css, *rest = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)  # Should remain unchanged
        self.assertEqual(result_css, expected_css)  # Should be an empty string


class TestClearImports(unittest.TestCase):

    def test_remove_specific_import_from_statements(self):
        """Test that clear_imports correctly removes the specified name from import statements."""

        # Test cases
        code_samples = [
            ("import { Stuff, OtherEntity } from 'lib';", "import { OtherEntity } from 'lib';"),
            ("import { OtherEntity, Stuff } from 'lib';", "import { OtherEntity } from 'lib';"),
            ("import { OtherEntity, Stuff, AnotherEntity } from 'lib';", "import { OtherEntity, AnotherEntity } from 'lib';"),
            ("import { Stuff } from 'lib';", ""),  # Entire line should be removed
            ("import {Stuff} from 'lib';", ""),  # Entire line should be removed
            ("import {Stuff } from 'lib';", ""),  # Entire line should be removed
            ("import { Stuff} from 'lib';", ""),  # Entire line should be removed
            ("import {  Stuff  } from 'lib';", ""),  # Entire line should be removed
            (" import  { Stuff }   from   'lib'; ", ""),  # Entire line should be removed
            ("import Stuff from 'lib';", ""),  # Entire line should be removed
            ("import { Stuff, SomeStuff } from 'lib';", "import { SomeStuff } from 'lib';"),  # Only Stuff should be removed
            ("import Stuff, { SomeStuff } from 'lib';", "import { SomeStuff } from 'lib';"),
            ("import Stuff, { Stuff, SomeStuff } from 'lib';", "import { SomeStuff } from 'lib';"),
            ("import Stuff, { Stuff } from 'lib';", ""),
            ("import SomeStuff, { Stuff, OtherEntity } from 'lib';", "import SomeStuff, { OtherEntity } from 'lib';"),
            ("import SomeStuff, { Stuff } from 'lib';", "import SomeStuff from 'lib';"),
            ("import { Entity as entity } from 'lib';", "import { Entity as entity } from 'lib';"),
            ("import { Foo as foo,   Bar as bar } from 'lib';", "import { Foo as foo, Bar as bar } from 'lib';"),
            ("import * as name from 'lib';", "import * as name from 'lib';"),
            ("import Stuff, * as name from 'lib';", "import * as name from 'lib';")
        ]

        for code, expected in code_samples:
            with self.subTest(code=code):
                self.assertEqual(clear_imports(code, "Stuff"), expected)


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

class AppTests(unittest.TestCase):
    def test_successful_build(self):
        client = TestClient(app)
        data = {
            "source_tree": [{
                "content": component,
                "file_path": "component.js"
            }, {
                "content": styles,
                "file_path": "styles.css"
            }]
        }
        response = client.post("/build-component/", json=data)
        self.assertEqual(200, response.status_code)

        response_json = response.json()
        self.assertTrue(response_json["success"])

        files = sorted(list(response_json["artifacts"].keys()))

        self.assertEqual(["index.html", "main.css", "main.js"], files)

        self.assertIn("MainComponent", response_json["artifacts"]["main.js"])
        self.assertIn(styles, response_json["artifacts"]["main.css"])
        self.assertIn('href="main.css"', response_json["artifacts"]["index.html"])
        

if __name__ == '__main__':
    unittest.main()
