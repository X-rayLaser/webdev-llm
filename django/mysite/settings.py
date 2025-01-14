from mysite.settings_base import *

GENERATION_BACKEND = "dummy"

SUMMARIZATION_BACKEND = "dummy"

TEXT_TO_IMAGE_BACKEND = "dummy"

try:
    from mysite.settings_local import *
except ImportError:
    print("WARNING: FAILED TO IMPORT LOCAL SETTINGS")
    pass
