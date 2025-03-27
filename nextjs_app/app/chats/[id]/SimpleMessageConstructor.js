"use client"
import { useState, useRef } from "react";
import { useActionState } from 'react';
import { AutoExpandingTextArea, ImageField } from "@/app/components/common-forms";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { FileField } from "@/app/components/common-forms";
import DropZone from "@/app/components/DropZone";
import { getTopDownRenderer } from "@/app/components/fieldset-renderers";
import { createTextModality, createMixedModality, createImageModality, createMultimediaMessage, 
    startMessageGeneration 
} from '@/app/actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faPaste } from '@fortawesome/free-solid-svg-icons';
import { OutlineButtonSmall, SubmitButton } from "@/app/components/buttons";
import { Alert } from "@/app/components/alerts";


const fields = [{
    name: "text",
    component: AutoExpandingTextArea,
    id: "simple_constructor_add_text_id",
    label: "Text"
}, {
    name: "image",
    type: "file",
    component: ImageField,
    id: "simple_constructor_add_image_id",
    label: "Image"
}];

const Form = formFactory(fields, getTopDownRenderer());

const imageIsSet = image => (image && image.size > 0) ? true : false


function ImageForm({ action, onSuccess, onPaste }) {
    const fileInputRef = useRef(null);
    const [runningSubmission, setRunningSubmission] = useState(false);
    const [text, setText] = useState("");
    const [preview, setPreview] = useState(null);

    const initialState = { message: null, errors: {} };
    const [formState, formAction] = useActionState(async function() {
        let res = await action(...arguments);

        setRunningSubmission(false);
        const states = { text }
        if (res.success) {
            onSuccess(res, states);
        } else {
            return res.responseData;
        }
    }, initialState);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            createPreview(file);
        }
    };

    const createPreview = (file) => {
        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    function handleDrop(files) {
        fileInputRef.current.files = files;
        createPreview(files[0]);
    }

    async function handlePasteImage(e) {
        try {
            const clipboardContents = await navigator.clipboard.read();
            const imageItems = clipboardContents.filter(item => item.types.includes("image/png"));

            if (imageItems.length > 0) {
                const item = imageItems[0];
                const blob = await item.getType("image/png");
                onPaste(blob);
                createPreview(blob);
            }
        } catch (error) {
            console.log(error.message);
        }
    }

    function handleSubmit(e) {
        setRunningSubmission(true);
    }

    return (
        <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AutoExpandingTextArea name="text"
                id="simple_constructor_add_text_id"
                label= "Text"
                value={text}
                errors={formState?.errors?.text || []}
                onChange={e => setText(e.target.value)}
                disabled={runningSubmission}
            />
            {formState?.message && (
                <div className="mt-5 mb-5">
                    <Alert text={formState.message} level="danger" />
                </div>
            )}

            {preview && (
                <div className="flex flex-col items-center space-y-2">
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-h-48 object-cover rounded"
                    />
                    <p className="text-sm text-gray-600">Drag a new image to replace</p>
                </div>
            )}

            <DropZone onDrop={handleDrop}>
                <div className="text-center text-gray-500">
                    <p>Drag and drop an image here</p>
                    <p>or</p>
                    <p>Click to select an image</p>
                </div>
            </DropZone>

            <div className="flex flex-col gap-2">
                <FileField
                    ref={fileInputRef}
                    name={"image"}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file:hidden cursor-pointer"
                />
                <div className="w-36">
                    <OutlineButtonSmall type="button" onClick={handlePasteImage}>
                        Paste image <FontAwesomeIcon icon={faPaste} />
                    </OutlineButtonSmall>
                </div>
            </div>

            <div className="w-44">
                <SubmitButton disabled={runningSubmission} text="Submit">
                {runningSubmission && <span className="ml-2"><FontAwesomeIcon icon={faCog} spin /></span>}
                </SubmitButton>
            </div>
        </form>
    )
}

export default function SimpleMessageConstructor({ chat, previousMessage, generationConfig }) {
    const [submissionError, setSubmissionError] = useState("");
    const [preview, setPreview] = useState(null);
    const [pastedBlob, setPastedBlob] = useState(null);
    
    async function createMessageAction(prevState, formData) {
        setSubmissionError("");

        const result = await createMixedModality();
        if (!result.success) {
            setSubmissionError(result.responseData.message);
            return result;
        }

        const parentModalityId = result.responseData.id;

        const text = formData.get("text");
        let image = formData.get("image");

        if (!imageIsSet(image)) {
            image = pastedBlob;
        }

        if (!text && !imageIsSet(image)) {
            return {
                success: false,
                responseData: {
                    message: "At least one of the [text, image] fields must be filled"
                }
            };
        }

        if (text) {
            const textFormData = new FormData();
            textFormData.append("text", text);
            const result = await createTextModality(parentModalityId, null, textFormData);
            if (!result.success) {
                setSubmissionError(result.responseData.message);
                return result;
            }
        }

        if (imageIsSet(image)) {
            const imageFormData = new FormData();

            if (!image.name) {
                imageFormData.append("image", image, 'clipboard_image.png');
            } else {
                imageFormData.append("image", image);
            }
            const result = await createImageModality(parentModalityId, null, imageFormData);
            if (!result.success) {
                setSubmissionError(result.responseData.message);
                return result;
            }
        }

        const role = previousMessage ? (
            previousMessage.role === "assistant" ? "user" : "assistant"
        ) : "user";

        const sourceFiles = [];
        const msgResult = await createMultimediaMessage(
            role, previousMessage.id, parentModalityId, sourceFiles
        );

        if (!msgResult.success) {
            setSubmissionError(msgResult.responseData.message);
            return msgResult;
        }

        if (role === "assistant") {
            return msgResult;
        }

        const parentMessageId = msgResult.responseData.id;
        const msgformData = new FormData();

        for (const [key, value] of Object.entries(generationConfig)) {
            msgformData.append(key, value);
        }
        const genMsgResult = await startMessageGeneration(chat.id, parentMessageId, null, msgformData);
        if (!genMsgResult.success) {
            setSubmissionError(genMsgResult.responseData.message);
        }
        return genMsgResult;
    }


    const handlePasteImage = async (e) => {
        try {
            const clipboardContents = await navigator.clipboard.read();
            const imageItems = clipboardContents.filter(item => item.types.includes("image/png"));

            if (imageItems.length > 0) {
                const item = imageItems[0];
                const blob = await item.getType("image/png");
                setPastedBlob(blob);
                const reader = new FileReader();

                reader.onload = () => setPreview(reader.result);
                reader.readAsDataURL(blob);
            }
        } catch (error) {
            console.log(error.message);
        }
    }

    const handleClearImage = async () => {
        setPreview(null);
    }

    const CreateForm = makeCreateForm(Form, createMessageAction);

    return (
        <div>
            <ImageForm action={createMessageAction} onSuccess={() => {}} onPaste={handlePasteImage} />
        </div>
    );
}
