"use client"
import React, { useState, useEffect } from 'react';
import { formFactory, makeCreateForm, makeEditForm } from "../components/form-factory";
import { getTopDownRenderer } from '../components/fieldset-renderers';
import { AutoExpandingTextArea, ImageField, TextField } from "../components/common-forms";
import { SubmitButton, CancelButton, OutlineButton, FixedSizeOutlineButton } from "../components/buttons";
import { createTextModality, createMixedModality, createImageModality, createCodeModality,
         updateModality, deleteModality, createMultimediaMessage, 
         startMessageGeneration } from '../actions';
import Modal from '../components/modal';
import { Alert } from '../components/alerts';
import { PanelItem, DeleteControl, Controls } from '../components/panels';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { fixUrlHost, getHostOrLocalhost, renderMarkdown } from '../utils';
import DrawingCanvas from './DrawingCanvasNew';
import { ReasoningItem, FunctionCallItem } from './[id]/WebSocketChat';


const textFormFields = [{
    name: "text",
    component: AutoExpandingTextArea,
    id: "add_text_modality_id",
    label: "Text"
}];

const imageFormFields = [{
    name: "image",
    type: "file",
    component: ImageField,
    id: "add_image_modality_id",
    label: "Image"
}];

const codeFormFields = [{
    name: "file_path",
    type: "text",
    component: TextField,
    id: "add_code_modality_file_path_id",
    label: "File Path"
}, {
    name: "code",
    component: AutoExpandingTextArea,
    id: "add_text_modality_code_id",
    label: "File Content"
}];

const TextForm = formFactory(textFormFields, getTopDownRenderer());
const ImageForm = formFactory(imageFormFields, getTopDownRenderer());
const CodeForm = formFactory(codeFormFields, getTopDownRenderer());


function createCodeActionFactory(actionWithParent) {
    async function codeAction(prevState, formData) {
        const code = formData.get("code") || "";
        if (code) {
            formData.delete("code");
        }

        const result = await actionWithParent(prevState, formData);

        return {
            success: result.success,
            responseData: {
                ...result.responseData,
                code
            }
        };
    }

    return codeAction;
}


function actionFactory(parent, setParent, modalityAction) {
    async function createAction() {
        let parentId;
        if (parent === null) {
            const result = await createMixedModality();
            const { success, responseData } = result;
            if (!success) {
                throw responseData.message;
            }
            parentId = responseData.id;
            setParent(parentId);
        } else {
            parentId = parent;
        }
        const action = modalityAction.bind(null, parentId);
        return await action(...arguments);
    }
    return createAction;
}


export default function AdvancedMessageConstructor({ formAction, rootModality=null, onCancel=null, generationConfig=null }) {
    const ADD_TEXT = "add_text";
    const ADD_IMAGE = "add_image";
    const ADD_CODE = "add_code";
    const DRAW_ON_CANVAS = "draw_on_canvas";

    const [mode, setMode] = useState(null);
    const initialParent = (rootModality && rootModality.id) || null;
    const [parent, setParent] = useState(initialParent); //mixed modality wrapping the modalities created
    
    const initialModalities = (rootModality && rootModality.mixture) || [];
    const [modalities, setModalities] = useState(initialModalities);
    const [submissionError, setSubmissionError] = useState("");
    const [sendingForm, setSendingForm] = useState(false);

    useEffect(() => {
        if (rootModality) {
            setParent(rootModality.id);
            setModalities(rootModality.mixture);
        }
    }, [rootModality]);

    function handleSuccessfulModalityCreation(res) {
        setMode(null);
        setModalities([...modalities, res.responseData]);
    }

    function handleSuccessfulTextUpdate(id, result) {
        const updatedModalities = modalities.map(mod => mod.id === id ? result.responseData : mod);
        setModalities(updatedModalities);
    }

    function handleSuccessfulTextDelete(id, result) {
        const updatedModalities = modalities.filter(mod => mod.id !== id);
        setModalities(updatedModalities);
    }

    const createActionFactory = actionFactory.bind(null, parent, setParent);

    const AddTextForm = makeCreateForm(TextForm, createActionFactory(createTextModality));
    const AddImageForm = makeCreateForm(ImageForm, createActionFactory(createImageModality));



    const AddCodeForm = makeCreateForm(
        CodeForm,
        createCodeActionFactory(createActionFactory(createCodeModality))
    );

    const sourceTree = modalities.filter(mod => mod.modality_type === "code").map(mod => ({
        file_path: mod.file_path, content: mod.code
    }));

    function resetState() {
        setModalities([]);
        setMode(null);
        setSubmissionError("");
        setParent(null);
    }

    async function createMessage() {
        setSubmissionError("");
        const { success, responseData } = await formAction(parent, sourceTree);
        if (!success) {
            setSubmissionError(responseData.message);
        }

        if (success) {
            resetState();
        }

        setSendingForm(false);
    }

    function handleSubmit(e) {
        setSendingForm(true);
    }

    async function handleGenerateResponse(e) {
        setSendingForm(true);

        setSubmissionError("");
        let { success, responseData } = await formAction(parent, sourceTree);
        
        if (!success) {
            setSubmissionError(responseData.message);
            setSendingForm(false);
            return;
        }

        const chatId = responseData.chat;
        const parentMessageid = responseData.id;
        const formData = new FormData();

        for (const [key, value] of Object.entries(generationConfig)) {
            formData.append(key, value);
        }

        const result = await startMessageGeneration(chatId, parentMessageid, null, formData);
        if (result.success) {
            resetState();
        } else {
            setSubmissionError(result.responseData.message);
        }

        setSendingForm(false);
    }

    return (
        <div className="bg-white py-4">
            <div>
                {modalities.length > 0 && (
                    <ModalityViewer
                        modalityObject={{
                            modality_type: "mixture",
                            mixture: modalities
                        }}
                        onSuccessfulUpdate={handleSuccessfulTextUpdate}
                        onSuccessfulDelete={handleSuccessfulTextDelete} />
                )}
                {modalities.length === 0 && (
                    <div className="flex justify-center">
                        <div className="text-3xl leading-relaxed text-center w-full lg:w-3/4 2xl:w-1/2 bg-indigo-100 p-8 border-2 border-indigo-500">
                            <p>Use these buttons below to add modalities one at a time.</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <div className="mt-4 flex gap-2 w-full flex-wrap justify-center">
                        <FixedSizeOutlineButton onClick={() => setMode(ADD_TEXT)} width={80} disabled={sendingForm}>
                            Text
                        </FixedSizeOutlineButton>
                        <FixedSizeOutlineButton onClick={() => setMode(ADD_IMAGE)} width={80} disabled={sendingForm}>
                            Image
                        </FixedSizeOutlineButton>
                        <FixedSizeOutlineButton onClick={() => setMode(DRAW_ON_CANVAS)} width={80} disabled={sendingForm}>
                            Sketch
                        </FixedSizeOutlineButton>
                        <FixedSizeOutlineButton onClick={() => setMode(ADD_CODE)} width={80} disabled={sendingForm}>
                            Code
                        </FixedSizeOutlineButton>
                    </div>
                </div>

                <Modal show={mode === ADD_TEXT} onClose={() => setMode(null)}>
                    <div className="p-6">
                        <AddTextForm onSuccess={handleSuccessfulModalityCreation} />
                    </div>
                </Modal>

                <Modal show={mode === ADD_IMAGE} onClose={() => setMode(null)}>
                    <div className="p-6">
                        <AddImageForm onSuccess={handleSuccessfulModalityCreation} />
                    </div>
                </Modal>

                <Modal title="Make a sketch" show={mode === DRAW_ON_CANVAS} onClose={() => setMode(null)}>
                    <div className="p-6">
                        <DrawingCanvas
                            action={createActionFactory(createImageModality)}
                            onSuccess={handleSuccessfulModalityCreation}
                        />
                    </div>
                </Modal>

                <Modal show={mode === ADD_CODE} onClose={() => setMode(null)}>
                    <div className="p-6">
                        <AddCodeForm onSuccess={handleSuccessfulModalityCreation} />
                    </div>
                </Modal>
            </div>
            <form action={createMessage} onSubmit={handleSubmit} className="text-lg mt-4">
                <div>
                    <div className="flex gap-2 justify-center">
                        {generationConfig && (
                            <div>
                                <SubmitButton
                                    text="Generate response"
                                    type="button"
                                    onClick={handleGenerateResponse}
                                    disabled={sendingForm || modalities.length === 0}
                                >
                                    {sendingForm && <span className="ml-2"><FontAwesomeIcon icon={faSpinner} spin /></span>}
                                </SubmitButton>
                            </div>
                        )}
                        <div>
                            <SubmitButton text="Save" disabled={sendingForm || modalities.length === 0}>
                                {sendingForm && <span className="ml-2"><FontAwesomeIcon icon={faSpinner} spin /></span>}
                            </SubmitButton>
                        </div>
                        {onCancel && (
                            <div>
                                <CancelButton
                                    type="button"
                                    text="Cancel"
                                    disabled={sendingForm}
                                    onClick={() => onCancel()}>
                                </CancelButton>
                            </div>
                        )}
                    </div>
                    {submissionError && (
                        <div className="mt-4">
                            <Alert level="danger" text={submissionError} />
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}

function Padding({ children }) {
    return (
        <div className="p-4">{children}</div>
    )
}


export function ModalityViewer({ modalityObject, onSuccessfulUpdate, onSuccessfulDelete, showControls=true }) {
    const { modality_type, ...rest } = modalityObject;

    let item;
    const props = {
        data: modalityObject,
        onSuccessfulUpdate,
        onSuccessfulDelete,
        showControls
    };

    if (modality_type === "text") {
        item = <Padding><TextModality {...props} /></Padding>;
    } else if (modality_type === "image") {
        item = <Padding><ImageModality {...props} /></Padding>;
    } else if (modality_type === "code") {
        item = <Padding><CodeModality {...props} /></Padding>;
    } else if (modality_type === "oai_item" && modalityObject.oai_item.type === "reasoning") {
            item = <Padding><ReasoningItem item={modalityObject.oai_item} header="Thoughts" /></Padding>
    } else if (modality_type === "oai_item" && (
                modalityObject.oai_item.type === "function_call" || 
                modalityObject.oai_item.type === "function_call_output")) {
        item = <Padding><FunctionCallItem item={modalityObject.oai_item} showSpinner={false} /></Padding>
    } else if (modality_type === "mixture") {
        let childrenItems = modalityObject.mixture.map((mod, idx) => 
            <div key={idx} className="border-b last:border-b-0"><ModalityViewer 
                modalityObject={mod}
                onSuccessfulUpdate={onSuccessfulUpdate}
                onSuccessfulDelete={onSuccessfulDelete}
                showControls={showControls}
            />
            </div>
        );

        item = (
            <div className="flex flex-col justify-evenly gap-4">
                {childrenItems}
            </div>
        );
    } else {
        item =  <div>Unknown modality</div>;
    }

    return item;
}


function makeDeleteAction(data, onSuccessfulDelete) {
    async function action() {
        const result = await deleteModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulDelete(data.id, result);
        return result;
    }

    return action;
}

function GenericModalityControls({
    data, 
    onSuccessfulUpdate, 
    onSuccessfulDelete,
    actionlessForm
}) {
    async function updateAction() {
        const result = await updateModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulUpdate(data.id, result);
        return result;
    }

    const EditTextForm = makeEditForm(actionlessForm, updateAction);

    return (
        <Controls
            data={data}
            editComponent={EditTextForm}
            deleteAction={makeDeleteAction(data, onSuccessfulDelete)}
            size="sm" />
    );
}

function TextModality({ data, onSuccessfulUpdate, onSuccessfulDelete, showControls=true }) {
    const renderedText = renderMarkdown(data.text || "");

    let innerHtml = {
        __html: renderedText
    };

    return (
        <div className="leading-relaxed text-lg">

            <div dangerouslySetInnerHTML={innerHtml} className="flex flex-col gap-4" />
            {showControls && (
                <GenericModalityControls
                    data={data}
                    onSuccessfulUpdate={onSuccessfulUpdate}
                    onSuccessfulDelete={onSuccessfulDelete}
                    actionlessForm={TextForm}
                />
            )}
        </div>
    );
}

function ImageModality({ data, onSuccessfulUpdate, onSuccessfulDelete, showControls=true }) {
    const [imageUrl, setImageUrl] = useState(null);
    const bgColor = showControls ? "bg-blue-100" : "bg-sky-800";

    useEffect(() => {
        const currentHost = getHostOrLocalhost(window);
        const fixedUrl = fixUrlHost(data.image, currentHost);
        setImageUrl(fixedUrl);
    }, [data]);
    return (
        <div className="rounded-lg">
            <div className="relative w-full">
                <div className={`px-2 rounded-lg h-96`}>
                    <img className="h-full mx-auto rounded-lg border-2 border-stone-900" src={imageUrl} />
                </div>
                <div className="absolute px-2 right-0 top-0">
                    {showControls && (
                        <GenericModalityControls
                            data={data}
                            onSuccessfulUpdate={onSuccessfulUpdate}
                            onSuccessfulDelete={onSuccessfulDelete}
                            actionlessForm={ImageForm}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function CodeModality({ data, onSuccessfulUpdate, onSuccessfulDelete, showControls=true }) {
    //todo: update API so as to allow updating code modality
    const [copied, setCopied] = useState(false);
    const [copying, setCopying] = useState(false);

    function copyToClipboard() {
        if (copying) {
            return;
        }
        setCopying(true);
        navigator.clipboard.writeText(data.code).then(() => {
            setCopying(false);
            setCopied(true);
            setTimeout(function() {
                setCopied(false);
            }, 4000);
        });
    }

    const fencedCode = `\`\`\`javascript
${data.code}
\`\`\``;
    const renderedCode = renderMarkdown(fencedCode);

    let innerHtml = {
        __html: renderedCode
    };

    return (
        <div className="rounded-lg">
            <div className="px-4 py-2 rounded-t-lg bg-gray-700 text-white">
                <div className="float-right text-gray-300">
                    {!copied && (
                        <button className="float-right" onClick={copyToClipboard}>
                            Copy <span className="ml-2"><FontAwesomeIcon icon={faCopy} /></span>
                        </button>
                    )}
                    {copied && <span className="text-green-400">Copied!</span>}
                </div>
                <div>{data.file_path}</div>
            </div>
            <div className="rounded-b-lg">
                {showControls && (
                    <div className="ml-[-4px] float-right">
                        <DeleteControl
                            data={data}
                            deleteAction={makeDeleteAction(data, onSuccessfulDelete)}
                            size="lg"
                        />
                    </div>
                )}

                <div dangerouslySetInnerHTML={innerHtml} />
            </div>
        </div>
    );
}
