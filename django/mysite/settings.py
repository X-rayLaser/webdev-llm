from mysite.settings_base import *

GENERATION_BACKEND = "dummy"

SUMMARIZATION_BACKEND = "first_n_chars"

TEXT_TO_IMAGE_BACKEND = "dummy"

LLM_BASED_NAME_EXTRACTION = False

TTS_BACKEND = {
    "name": "notts"
}

RAG_BACKEND = {
    "name": "norag"
}

try:
    from mysite.settings_local import *
except ImportError:
    print("WARNING: FAILED TO IMPORT LOCAL SETTINGS")
    pass
