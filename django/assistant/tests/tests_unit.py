import unittest
from unittest.mock import Mock
from django.test import TestCase
from rest_framework.test import APITestCase
from assistant.models import Chat, MultimediaMessage, Modality, Revision
from assistant.tests.utils import create_default_chat, create_message, create_text_modality
from assistant.utils import (
    process_raw_message, prepare_messages, convert_modality, MessageSegment,
    extract_segments_with_sources, prepare_build_files
)


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

    def test_code_then_text_use_jsx_language_specifier(self):
        raw_message = """
```jsx
// MainComponent.js

import React from 'react';

function MainComponent() {
    return <div>Hello World!</div>;
}

export default MainComponent;
```

This code defines a functional component named `MainComponent` that renders a simple "Hello World!" message. 
The component is then exported as the default export of the file, making it ready for use in other parts of your application.
You can save this code in a file named `MainComponent.js` and use it in your React app.
"""
        segments, sources = process_raw_message(raw_message)
        code_segment = segments[0]
        expected_content = """// MainComponent.js

import React from 'react';

function MainComponent() {
    return <div>Hello World!</div>;
}

export default MainComponent;"""
        expected_segment = MessageSegment(
            type="code", content=expected_content, 
            metadata={"language": "javascript", "file_path": "main.js"}
        )

        self.assertEqual(expected_segment, code_segment)
        self.assertEqual(sources[0]["content"], segments[0].content)
        self.assertEqual(sources[0]["file_path"], segments[0].metadata["file_path"])
        self.assertEqual(list(sorted(sources[0].keys())), ["content", "file_path"])

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

    def test_with_cpp(self):
        raw_message = "```c++\nint main() { return 0; }```"
        segments, sources = process_raw_message(raw_message)

        self.assertEqual(sources[0]["file_path"], segments[0].metadata["file_path"])
        self.assertEqual(sources[0]["content"], segments[0].content)
        self.assertEqual("int main() { return 0; }", sources[0]["content"])

    def test_single_language_block_with_two_files_comment_separated(self):
        raw_message = """
```jsx
// MainComponent.js
console.log(1)

// Secondary.js
console.log(2)
```
"""

        segments, sources = process_raw_message(raw_message)

        expected_segments = [
            MessageSegment(type="code", content="// MainComponent.js\nconsole.log(1)",
                           metadata={"language": "javascript", "file_path": "MainComponent.js"}),
            MessageSegment(type="code", content="// Secondary.js\nconsole.log(2)",
                           metadata={"language": "javascript", "file_path": "Secondary.js"}),
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

        self.run_subtests(cases, "")

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

    def test_one_component_imports_the_other_using_relative_path(self):
        raw_message = "```javascript\nconsole.log```\n```javascript\nimport { x } from './utils/api';```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "utils/api.js")
        self.assertEqual(sources[1]["file_path"], "main.js")

    def test_one_component_imports_the_other_using_relative_path_no_preceding_dot(self):
        raw_message = "```javascript\nconsole.log```\n```javascript\nimport { x } from 'utils/network/api';```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "utils/network/api.js")
        self.assertEqual(sources[1]["file_path"], "main.js")

    def test_one_component_imports_the_other_using_relative_path_with_dashes_and_underscoores(self):
        raw_message = "```javascript\nimport { x } from 'my_utils/Client-Server';```\n```javascript\nconsole.log```"
        _, sources = process_raw_message(raw_message)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[1]["file_path"], "my_utils/Client-Server.js")

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

    def test_names_extraction(self):
        test_cases = {
            "single_file": (
                "S file named script.js.```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_only_contains_relative_file_path": (
                "src/components/script.js```\nconsole.log('Hello');```",
                ["src/components/script.js"]
            ),
            "text_section_only_contains_relative_file_path_starting_with_dot": (
                "./src/components/script.js```\nconsole.log('Hello');```",
                ["src/components/script.js"]
            ),
            "text_section_only_contains_file_with_double_extension_starting_with_dot": (
                ".babel.js```\nconsole.log('Hello');```",
                [".babel.js"]
            ),
            "text_section_only_contains_relative_path_of_file_with_double_extension_starting_with_dot": (
                "src/.babel.js```\nconsole.log('Hello');```",
                ["src/.babel.js"]
            ),
            "text_section_contains_file_name_with_double_extension": (
                "webpack.config.js```\nconsole.log('Hello');```",
                ["webpack.config.js"]
            ),
            "text_section_contains_file_path_with_double_extension": (
                "Some text src/webpack.config.js some other text```\nconsole.log('Hello');```",
                ["src/webpack.config.js"]
            ),
            "text_section_contains_file_name_with_underscores_and_dashes": (
                "this is a file `webpack_files/web-pack.config.js` indeed```\nconsole.log('Hello');```",
                ["webpack_files/web-pack.config.js"]
            ),
            "text_section_only_contains_file_name": (
                "script.js```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_ends_with_file_name": (
                "Here is a script.js```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_ends_with_file_name_and_colon": (
                "Here is a script.js:```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_ends_with_file_name_and_colon_and_newline": (
                "Here is a script.js:\n```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_starts_with_file_name": (
                "script.js is shown below\n```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "text_section_contains_file_name_in_the_middle": (
                "Here is script.js shown below:\n```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "multiple_file_references_in_text_section": (
                "Here is file.py and styles.css. And here is script.js shown below:\n```\nconsole.log('Hello');```",
                ["script.js"]
            ),
            "test_section_contains_url": (
                "Some url 'https://fonts.example.com/css2'\n```\nconsole.log('Hello');```",
                ["untitled_0.js"]
            ),
            # todo: test with fonts.googleapis.com
            "js_file_name_given_in_a_comment": (
                "```javascript\n//comment line with file name 'script.js' in the middle\nsome content```",
                ["script.js"]
            ),
            "js_file_in_a_comment_no_space_after_comment_opener": (
                "```javascript\n//script.js in the middle\nsome content```",
                ["script.js"]
            ),
            "js_path_in_a_comment": (
                "```javascript\n//./src/some_script.js in the middle\nsome content```",
                ["src/some_script.js"]
            ),
            "ruby_file_name_given_in_a_comment_with_spaces": (
                "```javascript\n  //    script.rb in the middle\nsome content```",
                ["script.rb"]
            ),
            "python_file_name_given_in_a_comment": (
                "```\n\n\n# comment line with file name 'main.py' in the middle\nsome content```",
                ["main.py"]
            ),
            "path_to_python_file_given_in_a_comment": (
                "```\n\n\n# comment line with file name './src/test.Main_file.py' in the middle\nsome content```",
                ["src/test.Main_file.py"]
            ),
            "comment_name_overrides_name_referenced_in_preceding_text_section": (
                "The name of the file is script.js```\n# comment line with file name main.py in the middle\nsome content```",
                ["main.py"]
            ),
            "blank_code_section": (
                "```\n\n\n```",
                ["untitled_0"]
            ),
            "unnamed_js_code_block": (
                "Random text.```\nconsole.log('Test');```More text.",
                ["untitled_0.js"]
            ),
            "unnamed_cpp_code_block": (
                "Random text.```\n*(ptr++);```More text.",
                ["untitled_0"]
            ),
            "multiple_named_files": (
                "File a.js.```\nalert('A');```File b.js.```\nalert('B');```",
                ["a.js", "b.js"]
            ),
            "interleaved_text": (
                "Intro. File one.js.```\nconsole.log(1);```Some text. File two.js.```\nconsole.log(2);```",
                ["one.js", "two.js"]
            ),
            "mixed_named_js_file_and_unnamed": (
                "Code:```\nlet x = 1;```File known.js.```\nlet y = 2;```",
                ["untitled_0.js", "known.js"]
            ),
            "mixed_named_and_unnamed": (
                "Code:```\n*(ptr++);```File known.js.```\nlet y = 2;```",
                ["untitled_0", "known.js"]
            ),
            "text_then_js_code": (
                "Just some text.```javascript\nconsole.log('JS block');```",
                ["untitled_0.js"]
            ),
             "named_file_then_unknown_file": (
                "main.js:\n```\n'use client';```\nunknown file```\nsome text```",
                ["main.js", "untitled_0"]
            ),
            "file_sequence_mixture": (
                "````javascript\nconsole.log('JS');````\n````python\nprint('Python');````\n````javascript\nconsole.log('Another JS');````\n````\nUnknown code block\n````",
                ["untitled_0.js", "untitled_0.py", "untitled_1.js", "untitled_0"]
            ),
        }

        for case, (text, expected_names) in test_cases.items():
            with self.subTest(case):
                _, sources = extract_segments_with_sources(text)
                extracted_names = [source["file_path"] for source in sources]
                self.assertEqual(extracted_names, expected_names)


class PrepareBuildFilesTests(unittest.TestCase):
    def test_one_component_imports_the_other_using_relative_path_with_dashes_and_underscoores(self):
        raw_message = "```javascript\nimport { x } from 'my_utils/Client-Server';```\n```javascript\nconsole.log```"
        source_files = [
            {
                "file_path": "file1.js",
                "content": "import { x } from './my_utils/Client-Server';",
                "language": "javascript"
            },
            {
                "file_path": "file2.js",
                "content": "console.log;",
                "language": "javascript"
            },
        ]
        sources = prepare_build_files(source_files)

        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0]["file_path"], "main.js")
        self.assertEqual(sources[0]["content"], "import { x } from './my_utils/Client-Server';")
        self.assertEqual(sources[1]["file_path"], "my_utils/Client-Server.js")
        self.assertEqual(sources[1]["content"], "console.log;")


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


class PrepareMessagesTests(TestCase):
    
    def setUp(self):
        # Common mocks for the MultimediaMessage and Modality instances
        self.text_modality = Mock(spec=Modality, modality_type="text", text="Hello, world!")
        self.image_modality = Mock(spec=Modality, modality_type="image")
        self.image_modality.image = None
        
        self.code_modality = Mock(spec=Modality, modality_type="code", file_path="example.py")
        self.revision = Mock(spec=Revision, src_tree=[
            {"file_path": "example.py", "content": "print('Hello, code!')"}
        ])
        
        self.mixture_modality = Mock(spec=Modality, modality_type="mixture")
        self.mixture_modality.mixture.all.return_value = [self.text_modality, self.image_modality]
        
        # Mocking MultimediaMessage objects
        self.text_message = Mock(spec=MultimediaMessage, role="user", content=self.text_modality)
        self.image_message = Mock(spec=MultimediaMessage, role="assistant", content=self.image_modality)
        self.code_message = Mock(
            spec=MultimediaMessage, role="user", content=self.code_modality,
            active_revision=self.revision
        )
        self.mixed_message = Mock(spec=MultimediaMessage, role="system", content=self.mixture_modality)

    def test_convert_modality_text(self):
        """Test convert_modality handles text modality."""
        result = convert_modality(self.text_message, self.text_modality)
        expected = [{"type": "text", "text": "Hello, world!"}]
        self.assertEqual(result, expected)

    def test_convert_modality_image(self):
        """Test convert_modality handles image modality with URL conversion."""
        result = convert_modality(self.image_message, self.image_modality)
        expected = [{"type": "image_url", "image_url": None}]

    def test_convert_modality_code(self):
        """Test convert_modality handles code modality with src_tree lookup."""
        result = convert_modality(self.code_message, self.code_modality)
        expected = [{"type": "text", "text": "```\nprint('Hello, code!')\n```"}]
        self.assertEqual(result, expected)

    def test_convert_modality_mixture(self):
        """Test convert_modality handles mixture modality with recursive conversion."""
        result = convert_modality(self.mixed_message, self.mixture_modality)
        expected = [
            {"type": "text", "text": "Hello, world!"},
            {"type": "image_url", "image_url": None}
        ]
        self.assertEqual(result, expected)

    def test_prepare_messages_with_history(self):
        """Test prepare_messages with a list of history messages without system_message."""
        history = [self.text_message, self.image_message, self.code_message]
        result = prepare_messages(history)
        expected = [
            {"role": "user", "content": [{"type": "text", "text": "Hello, world!"}]},
            {"role": "assistant", "content": [{"type": "image_url", "image_url": None}]},
            {"role": "user", "content": [{"type": "text", "text": "```\nprint('Hello, code!')\n```"}]},
        ]
        self.assertEqual(result, expected)

    def test_prepare_messages_with_system_message(self):
        """Test prepare_messages includes system_message at the start if provided."""
        history = [self.text_message]
        system_message = "System initialization message."
        result = prepare_messages(history, system_message=system_message)
        expected = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": [{"type": "text", "text": "Hello, world!"}]}
        ]
        self.assertEqual(result, expected)

    def test_prepare_messages_with_empty_history(self):
        """Test prepare_messages handles empty history gracefully, only showing system_message if present."""
        result = prepare_messages([])
        self.assertEqual(result, [])
        
        system_message = "System message only."
        result_with_system = prepare_messages([], system_message=system_message)
        expected_with_system = [{"role": "system", "content": system_message}]
        self.assertEqual(result_with_system, expected_with_system)
