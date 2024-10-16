import unittest
from main import (
    preprocess, NoSourceFilesError, NoJsCodeError, EmptyJavascriptFileError,
    MalformedFileEntryError
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

        expected_js = "console.log('Hello World');"
        expected_css = "body { background-color: black; }"

        result_js, result_css = preprocess(source_tree)
        
        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)

    def test_source_tree_with_no_css_file_returns_empty_string_for_css(self):
        """Test that source_tree with a JS file but no CSS file returns empty string for CSS."""
        source_tree = [
            { "content": "console.log('Hello World');", "file_path": "script.js" }
        ]

        expected_js = "console.log('Hello World');"
        expected_css = ""  # No CSS file, so CSS output should be an empty string

        result_js, result_css = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)

    def test_source_tree_with_multiple_js_files_returns_first_js(self):
        """Test that source_tree with multiple JS files returns content of the first JS file."""
        source_tree = [
            { "content": "console.log('First JS');", "file_path": "script1.js" },
            { "content": "console.log('Second JS');", "file_path": "script2.js" },
            { "content": "console.log('Third JS');", "file_path": "script3.js" },
            { "content": "body { background-color: black; }", "file_path": "style.css" }
        ]

        expected_js = "console.log('First JS');"
        expected_css = "body { background-color: black; }"

        result_js, result_css = preprocess(source_tree)

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

        expected_js = "console.log('JS Code');"
        expected_css = "body { background-color: black; }"  # First CSS file

        result_js, result_css = preprocess(source_tree)

        self.assertEqual(result_js, expected_js)
        self.assertEqual(result_css, expected_css)  # Should return the first CSS file


if __name__ == '__main__':
    unittest.main()
