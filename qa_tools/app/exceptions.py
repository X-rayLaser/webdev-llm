class BadSourceCodeError(Exception):
    def detail(self):
        return "Bad format of source_tree"


class NoSourceFilesError(BadSourceCodeError):
    def detail(self):
        return "No source files provided"


class NoJsCodeError(BadSourceCodeError):
    def detail(self):
        return 'Expected at least one file entry with ".js" extension'


class EmptyJavascriptFileError(BadSourceCodeError):
    def detail(self):
        return f'Found blank file: "{self.args[0]}"'


class MalformedFileEntryError(BadSourceCodeError):
    def detail(self):
        return f'Malformed file entry: missing required field "{self.args[0]}"'
