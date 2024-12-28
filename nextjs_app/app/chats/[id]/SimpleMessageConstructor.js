"use client"
import { useState } from "react";
import { AutoExpandingTextArea, ImageField } from "@/app/components/common-forms";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { getTopDownRenderer } from "@/app/components/fieldset-renderers";
import { createTextModality, createMixedModality, createImageModality, createMultimediaMessage, 
    startMessageGeneration 
} from '@/app/actions';

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

const imageIsSet = image => (image && image.name && image.size > 0) ? true : false

export default function SimpleMessageConstructor({ chat, previousMessage, generationConfig }) {
    const [submissionError, setSubmissionError] = useState("");

    async function createMessageAction(prevState, formData) {
        setSubmissionError("");

        const result = await createMixedModality();
        if (!result.success) {
            setSubmissionError(result.responseData.message);
            return result;
        }

        const parentModalityId = result.responseData.id;

        const text = formData.get("text");
        const image = formData.get("image");

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
            imageFormData.append("image", image);
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

    const CreateForm = makeCreateForm(Form, createMessageAction);

    return (
        <div>
            {submissionError && <div>{submissionError}</div>}
            <CreateForm onSuccess={() => {}}/>
        </div>
    );
}