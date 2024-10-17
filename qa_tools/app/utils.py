import re
from .exceptions import ComponentNotFoundError


def clear_bracket_imports(imports_str, to_remove):
    import_list = [name.strip() for name in imports_str.split(',')]
    import_list = [name for name in import_list if name and name != to_remove]
    return ', '.join(import_list) if import_list else ''


def clear_default_and_named_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    default_import, imports_str, lib_str = matches[0]
    new_import_str = clear_bracket_imports(imports_str, to_remove)
    default_import = "" if default_import == to_remove else default_import

    if default_import and new_import_str:
        return 'import {}, {{ {} }} from {}'.format(default_import, new_import_str.strip(), lib_str)

    if default_import:
        return 'import {} from {}'.format(default_import, lib_str)
    
    if new_import_str:
        return 'import {{ {} }} from {}'.format(new_import_str, lib_str)
    
    return ""


def clear_default_with_namespace_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    default_import, name_space, lib_str = matches[0]
    if default_import == to_remove:
        return f'import * as {name_space} from {lib_str}'
    return text


def clear_named_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    imports_str, lib_str = matches[0]
    new_import_str = clear_bracket_imports(imports_str, to_remove)

    if not new_import_str:
        return ""

    return 'import {{ {} }} from {}'.format(new_import_str, lib_str)


def clear_default_import(regex, text, to_remove):
    matches = re.findall(regex, text)
    if matches and matches[0] == to_remove:
        return ""
    return text


def clear_imports(code, to_remove="React"):

    def fix_import_line(match):
        text = match.group(0).strip()

        default_and_named_import = 'import\s+([a-zA-Z]+)\s*,\s*{(.*)}\s+from\s+(.*)'

        if re.search(default_and_named_import, text):
            return clear_default_and_named_import(default_and_named_import, text, to_remove)

        default_and_namespace_import = 'import\s+([a-zA-Z]+)\s*,\s*\* as ([a-zA-Z]+)\s+from\s+(.*)'

        if re.search(default_and_namespace_import, text):
            return clear_default_with_namespace_import(default_and_namespace_import, text, to_remove)

        named_import = 'import\s+{(.*)}\s+from\s+(.*)'
        
        if re.search(named_import, text):
            return clear_named_import(named_import, text, to_remove)

        default_import = 'import\s+([a-zA-Z]+)\s+from'
        if re.search(default_import, text):
            return clear_default_import(default_import, text, to_remove)

        return text

    pattern = re.compile('\s*import .* from .*')
    return pattern.sub(fix_import_line, code)


def fix_css_imports(js_code, css_entries):
    if css_entries:
        file_path = css_entries[0]["file_path"]
        import_path = f"./{file_path}"
        css_import1 = f'import "{import_path}";\n'
        css_import2 = f"import '{import_path}';\n"
        has_css_import = css_import1 in js_code or css_import2 in js_code

        if not has_css_import:
            js_code = f'import "./{file_path}";\n' + js_code

    return js_code


def parse_name(code):
    matcher = re.compile("function\s+([A-Z][a-zA-Z0-9]*)\(.*\)\s*\{.*\s*return.*\s*\}")
    arrow_matcher = re.compile("((const|let)\s+([A-Z][a-zA-Z0-9]*)\s*=.*=>)")
    matches = matcher.findall(code)
    if not matches:
        matches = arrow_matcher.findall(code)
        if not matches:
            raise ComponentNotFoundError
        _, _, name = matches[-1]
        return name
    
    return matches[-1]


def props_to_string(props: dict) -> str:
    props = props or {}
    return " ".join(f'{k}="{v}"' for k, v in props.items())


def save_to_file(path, content):
    with open(path, "w") as f:
        f.write(content)


def load_file(path):
    with open(path) as f:
        return f.read()
