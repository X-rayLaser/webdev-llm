"use client"
import { useState, useRef, useEffect } from "react";
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
import { faCog, faPaste, faFileArrowUp, faCamera } from '@fortawesome/free-solid-svg-icons';
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


function PhotoCamera({ width=480, onPictureTaken, onCancel }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [height, setHeight] = useState(0);
    const [error, setError] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [videoSrc, setVideoSrc]= useState(null);

    useEffect(() => {
        function prepare() {
            navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
                if (videoRef.current && window) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play = true;
                }
            }).catch((err) => {
                console.error(`An error occurred: ${err}`);
                setError("Failed to access a camera. Make sure to plug the device and set permissions")
            });
    
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;

                video.addEventListener("canplay", ev => {
                    if (!streaming) {
                        const height = (video.videoHeight / video.videoWidth) * width;
                        setHeight(height);
    
                        video.setAttribute("width", width);
                        video.setAttribute("height", height);
                        canvas.setAttribute("width", width);
                        canvas.setAttribute("height", height);
                        setStreaming(true);
                        console.log("STREAMING STARTED!")
                    }
                }, false);
            }
        }

        prepare();
    });

    function reset() {
        if (!canvasRef.current) {
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        context.fillStyle = "#AAA";
        context.fillRect(0, 0, canvas.width, canvas.currentheight);
    }

    function handleTakePicture(e) {
        if (width && height && videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const context = canvas.getContext("2d");

            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);

            canvas.toBlob(onPictureTaken);
        } else {
            reset();
        }
    }

    return (
        <div>

            {error && <Alert text={error} level="danger" />}
            <canvas ref={canvasRef} className="hidden"></canvas>
            <video ref={videoRef} autoPlay />
            <div className="flex gap-2">
                <OutlineButtonSmall type="button" onClick={onCancel}>Cancel</OutlineButtonSmall>
                <OutlineButtonSmall type="button" onClick={handleTakePicture}>Take picture</OutlineButtonSmall>
            </div>
        </div>
    );
}


function ImageForm({ action, onSuccess, onPaste }) {
    const fileInputRef = useRef(null);
    const [runningSubmission, setRunningSubmission] = useState(false);
    const [text, setText] = useState("");
    const [preview, setPreview] = useState(null);
    const [streaming, setStreaming] = useState(false);

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

    function handleTakePicture(blob) {
        onPaste(blob);
        createPreview(blob);
        setStreaming(false);
    }

    function handleSubmit(e) {
        setRunningSubmission(true);
    }

    return (
        <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!streaming && (
                <AutoExpandingTextArea name="text"
                    id="simple_constructor_add_text_id"
                    label= "Text"
                    value={text}
                    errors={formState?.errors?.text || []}
                    onChange={e => setText(e.target.value)}
                    disabled={runningSubmission}
                />
            )}
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
                        className="max-h-60 object-cover rounded"
                    />
                    <p className="text-sm text-gray-600">Drag a new image to replace</p>
                </div>
            )}


            {streaming ? <PhotoCamera onCancel={() => setStreaming(false)} onPictureTaken={handleTakePicture} /> : (
                <DropZone onDrop={handleDrop}>
                    <div className="text-center text-gray-500">
                        <p>Drag and drop an image here</p>
                        <p>or</p>
                        <p>Click to select an image</p>
                    </div>
                </DropZone>
            )}

            {!streaming && (
                <div className="flex justify-between">
                    <div className="flex gap-2 justify-center items-center">
                        <div className="relative rounded-lg hover:bg-sky-800">
                            <input
                                ref={fileInputRef}
                                name={"image"}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute h-full w-full opacity-0 z-10 file:hidden cursor-pointer"
                            />
                            <OutlineButtonSmall type="button">
                                <FontAwesomeIcon icon={faFileArrowUp} className="text-2xl text-blue-400" />
                            </OutlineButtonSmall>
                        </div>
                        <div className="">
                            <OutlineButtonSmall type="button" onClick={handlePasteImage}>
                                <FontAwesomeIcon icon={faPaste} className="text-2xl text-blue-400" />
                            </OutlineButtonSmall>
                        </div>
                        <OutlineButtonSmall type="button" onClick={() => setStreaming(true)}>
                            <FontAwesomeIcon icon={faCamera} className="text-2xl text-blue-400" />
                        </OutlineButtonSmall>
                    </div>

                    <SubmitButton disabled={runningSubmission} text="Submit">
                    {runningSubmission && <span className="ml-2"><FontAwesomeIcon icon={faCog} spin /></span>}
                    </SubmitButton>
                </div>
            )}
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


    const handlePasteImage = async (blob) => {
        setPastedBlob(blob);
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result);
        reader.readAsDataURL(blob);
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
