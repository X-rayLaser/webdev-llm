import unittest
from rest_framework.test import APITestCase
from assistant.models import Chat, MultimediaMessage
from assistant.tests.utils import create_default_chat, create_message, create_text_modality
from assistant.utils import process_raw_message, MessageSegment


class ProcessRawMessageTests(unittest.TestCase):

    def test_single_code_block(self):
        raw_message = "```javascript\nconsole.log('Hello, world!')\n```"
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="code", content="console.log('Hello, world!')\n", 
                           metadata={"language": "javascript", "file_path": "main.js"})
        ]
        self.assertEqual(segments, expected_segments)
        
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["file_path"], segments[0].metadata["file_path"])
        self.assertEqual(sources[0]["content"], segments[0].content)

    def test_single_text_segment(self):
        raw_message = "Hello, this is a simple text segment."
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="text", content="Hello, this is a simple text segment.", metadata=None)
        ]
        self.assertEqual(segments, expected_segments)
        self.assertEqual(len(sources), 0)

    def test_text_then_code(self):
        raw_message = "This is text.\n```python\nprint('Code!')\n```"
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="text", content="This is text.\n", metadata=None),
            MessageSegment(type="code", content="print('Code!')\n",
                           metadata={"language": "python", "file_path": "main.py"})
        ]
        self.assertEqual(segments, expected_segments)
        
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["content"], segments[1].content)
        self.assertEqual(sources[0]["file_path"], segments[1].metadata["file_path"])

    def test_code_then_text(self):
        raw_message = "```python\nprint('Code!')\n```\nThis is text."
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="code", content="print('Code!')\n",
                           metadata={"language": "python", "file_path": "main.py"}),
            MessageSegment(type="text", content="\nThis is text.", metadata=None)
        ]
        self.assertEqual(segments, expected_segments)
        
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["content"], segments[0].content)
        self.assertEqual(sources[0]["file_path"], segments[0].metadata["file_path"])

    def test_text_code_text(self):
        raw_message = "Intro text.\n```javascript\nconsole.log('Hi!')\n```\nEnd text."
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="text", content="Intro text.\n", metadata=None),
            MessageSegment(type="code", content="console.log('Hi!')\n", 
                           metadata={"language": "javascript", "file_path": "main.js"}),
            MessageSegment(type="text", content="\nEnd text.", metadata=None)
        ]
        self.assertEqual(segments, expected_segments)
        
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["content"], segments[1].content)
        self.assertEqual(sources[0]["file_path"], segments[1].metadata["file_path"])

    def test_multiple_text_segments(self):
        raw_message = "First text.\nAnother text."
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="text", content="First text.\nAnother text.", metadata=None)
        ]
        self.assertEqual(segments, expected_segments)
        self.assertEqual(len(sources), 0)

    def test_multiple_code_segments(self):
        raw_message = "```javascript\nconsole.log('First code')\n```\n```css\np { width: 100%; }\n```"
        segments, sources = process_raw_message(raw_message)
        
        expected_segments = [
            MessageSegment(type="code", content="console.log('First code')\n",
                           metadata={"language": "javascript", "file_path": "main.js"}),
            MessageSegment(type="code", content="p { width: 100%; }\n",
                           metadata={"language": "css", "file_path": "styles.css"})
        ]
        self.assertEqual(segments, expected_segments)
        
        self.assertEqual(len(sources), 2)
        for i, segment in enumerate(expected_segments):
            self.assertEqual(sources[i]["content"], segment.content)


class LanguageDetectionTests(unittest.TestCase):
    def test_javascript_code_block_with_unspecified_language(self):
        cases = {
            "contains_console_log": "```\nconsole.log('Hello!')\n```",
            "contains_const_variable_definition": "```const x = 25;```",
            "contains_let_variable_definition": "```let y='something'```",

            # Basic cases
            "basic_function_no_params_no_return": "```function greet() { console.log('Hello'); }```",
            "basic_function_with_params_no_return": "```function add(a, b) { console.log(a + b); }```",
            "basic_function_with_params_with_return": "```function multiply(x, y) { return x * y; }```",
            
            # Spacing variations
            "function_with_multiple_spaces": "```function    test( )    { console.log('Testing');    }```",
            "function_with_extra_spaces_between_params": "```function calculate( a , b ) { return a + b; }```",
            "function_with_tabs": "```function\tdemo(\tx,\ty\t)\t{\treturn\tx\t+\ty;\t}```",
            
            # Parameter variations
            "function_no_params_with_return": "```function getPi() { return 3.14159; }```",
            "function_with_single_param": "```function double(n) { return n * 2; }```",
            "function_with_default_params": "```function greet(name = 'Guest') { console.log('Hello ' + name); }```",
            "function_with_multiple_default_params": "```function configure(host = 'localhost', port = 80) { return host + ':' + port; }```",
            "function_with_multiline_params": "```function example(\n  arg1, \n  arg2,\n  arg3\n) { return arg1 + arg2 + arg3; }```",
            
            # Return variations
            "function_with_return": "```function sum(a, b) { return a + b; }```",
            "function_no_return": "```function logMessage(message) { console.log(message); }```",
            "function_empty_body": "```function doNothing() { }```",
            
            # Arrow function conversions for contrast
            "arrow_function_with_return": "```const add = (a, b) => { return a + b; };```",
            "arrow_function_without_return": "```const logMessage = message => console.log(message);```",
            "arrow_function_without_params_without_return": "```const logMessage = () => console.log(message);```",
            "arrow_function_multiline_body": "```const greet = (name) => {\n  console.log('Hello ' + name);\n  console.log('Welcome!');\n};```",

            # With or without semicolons
            "function_with_semicolons": "```function square(x) { return x * x; };```",
            "function_without_semicolons": "```function cube(x) { return x * x * x }```",
            
            # Multiple functions in one code block
            "multiple_functions": "```function add(x, y) { return x + y; }\nfunction subtract(x, y) { return x - y; }```",
            
            # Complex cases with inner functions
            "nested_function": "```function outer(a) { function inner(b) { return a + b; } return inner; }```",
            "complex_nested_function": "```function parent(a) { const child = function(b) { return a * b; }; return child; }```",
            
            # Anonymous function
            "anonymous_function_assignment": "```const anonymous = function(x, y) { return x * y; };```",
            "immediately_invoked_function": "```(function(message) { console.log(message); })('Hello');```",
            
            # Async and other modifiers
            "async_function": "```async function fetchData(url) { const response = await fetch(url); return response.json(); }```",
            "function_with_callbacks": "```function getData(callback) { setTimeout(() => callback('data'), 1000); }```",
            
            # Large and complex code block
            "complex_function_with_comments": """```
                function processItems(items) {
                    // Loop through each item
                    for (let i = 0; i < items.length; i++) {
                        if (items[i] % 2 === 0) {
                            console.log('Even number:', items[i]);
                        } else {
                            console.log('Odd number:', items[i]);
                        }
                    }
                }
            ```"""
        }

        self.run_subtests(cases, "javascript")

    def test_css_code_block_with_unspecified_language(self):
        cases = {
            "contains_css_selector_styles": "```p { height: 100%; }```"
        }

        self.run_subtests(cases, "css")

    def run_subtests(self, cases, expected_language):

        for case in cases:
            msg = cases[case]
            with self.subTest(case):
                segments, _ = process_raw_message(msg)
                self.assertEqual(len(segments), 1)
                self.assertEqual(segments[0].metadata["language"], expected_language)


class SourceFilesNameResolutionTests(unittest.TestCase):
    def test_has_only_css_file(self):
        raw_message = "```css\np { height: 100%; }```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["file_path"], "styles.css")

    def test_has_only_js_file(self):
        raw_message = "```javascript\nconsole.log```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["file_path"], "main.js")

    def test_has_1_js_file_and_1_css_file(self):
        raw_message = "```javascript\nconsole.log```\n```css\n p { height: 100%; }```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "styles.css")

    def test_has_2_js_files_and_1_css_file(self):
        raw_message = """
        main.js
        ```javascript\nconsole.log```\n
        style_file.css:
        ```css\n p { height: 100%; }```
        utils.js:
        ```javascript\nlet x = 42```
        """
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 3)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "style_file.css")
        self.assertEqual(sources[2]["file_path"], "utils.js")

    def test_has_1_js_file_importing_the_other(self):
        raw_message = "```javascript\nconsole.log```\n```javascript\nimport x from 'utils'```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "utils.js")
        self.assertEqual(sources[1]["file_path"], "main.js")

    def test_has_2_js_files_with_library_imports(self):
        raw_message = """
        ```javascript
        console.log
        ```
        ```javascript
        import React from "react";
        import 'utils';
        import { createStore } from "redux";
        ```
        """
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "utils.js")
        self.assertEqual(sources[1]["file_path"], "main.js")

    def test_has_2_js_files_with_multiple_library_imports_per_line(self):
        raw_message = """
        ```javascript
        console.log
        ```
        ```javascript
        import React, { Component } from 'react'
        import { 
            x, y
        } from 'utils'
        import { createStore, xyz } from "redux"

        ```
        """
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "utils.js")
        self.assertEqual(sources[1]["file_path"], "main.js")

    def test_has_2_js_file_without_imports(self):
        raw_message = "```javascript\nconsole.log```\n```javascript\nconst x = 23'```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "module1.js")
        self.assertEqual(sources[1]["file_path"], "module2.js")

    def test_has_2_js_file_without_imports_with_names(self):
        raw_message = "main.js:\n```javascript\nconsole.log```\nconfig.js:\n```javascript\nconst x = 23'```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "config.js")

    def test_has_2_js_file_without_imports_with_some_names_missing(self):
        raw_message = "main.js:\n```javascript\nconsole.log```\n```javascript\nconst x = 23'```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "module2.js")

    def test_multiple_code_sections_preceded_by_quated_names(self):
        raw_message = """
        "main.js":
        ```javascript\nconsole.log```\n
        "config.js":
        ```javascript\nconst x = 23'```\n
        'utils.js':
        ```function foo() {}```\n
        """
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 3)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "config.js")
        self.assertEqual(sources[2]["file_path"], "utils.js")

    def test_multiple_code_sections_preceded_by_text_with_paths(self):
        raw_message = """
        Here is a .js file:
        "project/main.js":
        ```javascript\nconsole.log```\n
        Next, we implemented a configuration file:
        "project/config.js":
        ```javascript\nconst x = 23'```\n

        Finally, we write a file utils containing utility functions:
        'project/utils.js':
        ```function foo() {}```\n
        """
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 3)
        self.assertEqual(sources[0]["file_path"], "project/main.js")
        self.assertEqual(sources[1]["file_path"], "project/config.js")
        self.assertEqual(sources[2]["file_path"], "project/utils.js")


class MultimediaMessageMethodTests(APITestCase):

    def setUp(self):
        # Set up a chat and initial message chain for tests
        self.chat_id = create_default_chat(self.client)
        self.chat = Chat.objects.get(id=self.chat_id)

        text1 = "This is a first text modality"
        text2 = "This is a second text modality"
        text3 = "This is a third text modality"
        
        # Create a root message
        self.root_message_obj = self.create_text_message(
            text=text1, role="user", chat_id=self.chat_id
        )

        # Create a reply to the root message
        self.reply1_obj = self.create_text_message(
            text=text2, role="assistant", parent_id=self.root_message_obj.id
        )

        # Create another reply to the first reply
        self.reply2_obj = self.create_text_message(
            text=text3, role="user", parent_id=self.reply1_obj.id
        )

    def create_text_message(self, text, role, chat_id=None, parent_id=None):
        text_modality_response = create_text_modality(
            self.client, text=text)
        mod_id = text_modality_response.data['id']

        msg_data = create_message(
            self.client, modality_id=mod_id, chat_id=chat_id, parent_id=parent_id, role=role
        ).data

        return MultimediaMessage.objects.get(id=msg_data['id'])

    def test_get_root_on_root_message(self):
        """Ensure get_root returns itself if the message is the root."""
        root = self.root_message_obj.get_root()
        self.assertEqual(root, self.root_message_obj)

    def test_get_root_on_nested_reply(self):
        """Ensure get_root returns the root message for a reply chain."""
        root = self.reply2_obj.get_root()
        self.assertEqual(root, self.root_message_obj)

    def test_get_history_on_root_message(self):
        """Ensure get_history returns only the root message if there are no replies."""
        history = self.root_message_obj.get_history()
        self.assertEqual(history, [self.root_message_obj])

    def test_get_history_on_nested_reply(self):
        """Ensure get_history returns the correct sequence of messages from root to current."""
        history = self.reply2_obj.get_history()
        expected_history = [self.root_message_obj, self.reply1_obj, self.reply2_obj]
        self.assertEqual(history, expected_history)

    def test_get_history_on_first_reply(self):
        """Ensure get_history returns correct history for the first reply."""
        history = self.reply1_obj.get_history()
        expected_history = [self.root_message_obj, self.reply1_obj]
        self.assertEqual(history, expected_history)
