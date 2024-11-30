"use client"
import React, { useState } from 'react';
import { formFactory, makeCreateForm, makeEditForm } from "../components/form-factory";
import { getTopDownRenderer } from '../components/fieldset-renderers';
import { AutoExpandingTextArea, ImageField } from "../components/common-forms";
import { OutlineButton } from "../components/buttons";
import { createTextModality, createMixedModality, updateTextModality, deleteTextModality,
         createImageModality, updateImageModality, deleteImageModality } from '../actions';
import Modal from '../components/modal';
import { Alert } from '../components/alerts';
import { PanelItem, Controls } from '../components/panels';

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
}]

const TextForm = formFactory(textFormFields, getTopDownRenderer());
const ImageForm = formFactory(imageFormFields, getTopDownRenderer());

export default function AdvancedMessageConstructor() {
    const ADD_TEXT = "add_text";
    const ADD_IMAGE = "add_image";
    const ADD_CODE = "add_code";

    const [mode, setMode] = useState(null);
    const [parent, setParent] = useState(null);
    const [modalities, setModalities] = useState([]);

    function actionFactory(modalityAction) {
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

    function handleSuccessfulTextSubmission(res) {
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

    function handleSuccessfulImageUpload(res) {
        setMode(null);
        setModalities([...modalities, res.responseData]);
    }

    const AddTextForm = makeCreateForm(TextForm, actionFactory(createTextModality));
    const AddImageForm = makeCreateForm(ImageForm, actionFactory(createImageModality));

    return (
        <div className="border rounded-lg shadow-md p-4 bg-slate-200">
            <h2 className="font-bold text-lg mb-2">Advanced message constructor</h2>
            {modalities.length > 0 && (
                <ModalityMixturePanel 
                    mixture={modalities}
                    onSuccessfulUpdate={handleSuccessfulTextUpdate}
                    onSuccessfulDelete={handleSuccessfulTextDelete} />
            )}
            {modalities.length === 0 && (
                <h2 className="text-2xl text-center">
                    No modalities added so far.
                </h2>
            )}
            <div className="my-4 max-w-80">
                <Alert text="You can add new modalities using these buttons below" size="md" />
            </div>

            <div className="flex gap-4 w-96 flex-wrap">
                <div className="">
                <OutlineButton onClick={() => setMode(ADD_TEXT)}>
                    Add text
                </OutlineButton>
                </div>
                <OutlineButton onClick={() => setMode(ADD_IMAGE)}>Add image</OutlineButton>
                <OutlineButton>Add code</OutlineButton>
            </div>

            <Modal show={mode === ADD_TEXT} onClose={() => setMode(null)}>
                <div className="p-6">
                    <AddTextForm onSuccess={handleSuccessfulTextSubmission} />
                </div>
            </Modal>

            <Modal show={mode === ADD_IMAGE} onClose={() => setMode(null)}>
                <div className="p-6">
                    <AddImageForm onSuccess={handleSuccessfulImageUpload} />
                </div>
            </Modal>
        </div>
    );
}

function ModalityMixturePanel({ mixture, onSuccessfulUpdate, onSuccessfulDelete }) {
    const items = mixture.map((data, idx) => {
        const { modality_type, ...rest } = data;
        let item;
        const props = {
            data,
            onSuccessfulUpdate,
            onSuccessfulDelete
        }
        if (modality_type === "text") {
            item = <TextModality {...props} />;
        } else if (modality_type === "image") {
            item = <ImageModality {...props} />
        } else {
            item =  <div>Unknown modality</div>;
        }

        return <div key={idx}>{item}</div>;
    });

    return (
        <div className="flex flex-col justify-evenly gap-2 rounded-lg">
            {items}
        </div>
    );
}

function TextModality({ data, onSuccessfulUpdate, onSuccessfulDelete }) {

    async function updateAction() {
        const result = await updateTextModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulUpdate(data.id, result);
        return result;
    }

    async function deleteAction() {
        const result = await deleteTextModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulDelete(data.id, result);
        return result;
    }

    const EditTextForm = makeEditForm(TextForm, updateAction);

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <div className="mb-2">{data.text}</div>
            <Controls
                data={data}
                editComponent={EditTextForm}
                deleteAction={deleteAction} />
        </div>
    );
}

function ImageModality({ data, onSuccessfulUpdate, onSuccessfulDelete }) {
    async function updateAction() {
        const result = await updateImageModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulUpdate(data.id, result);
        return result;
    }

    async function deleteAction() {
        const result = await deleteImageModality(...arguments);
        if (!result.success) {
            return result;
        }
        onSuccessfulDelete(data.id, result);
        return result;
    }

    const EditTextForm = makeEditForm(ImageForm, updateAction);

    return (
        <div className="border rounded-lg shadow-sm">
            <div className="px-2 rounded-lg h-96 bg-blue-950">
                <img className="h-full border-x-2 border-white mx-auto" src={data.image.replace("django:8000", "localhost")} />
            </div>
            <div className="px-2">
                <Controls
                    data={data}
                    editComponent={EditTextForm}
                    deleteAction={deleteAction} />
            </div>
        </div>
    );
}