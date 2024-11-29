"use client"
import React, { useState } from 'react';
import { formFactory, makeCreateForm, makeEditForm } from "../components/form-factory";
import { getTopDownRenderer } from '../components/fieldset-renderers';
import { AutoExpandingTextArea } from "../components/common-forms";
import { OutlineButton } from "../components/buttons";
import { createTextModality, createMixedModality, updateTextModality, deleteTextModality } from '../actions';
import Modal from '../components/modal';
import { Alert } from '../components/alerts';
import { PanelItem } from '../components/panels';

const textFormFields = [{
    name: "text",
    component: AutoExpandingTextArea,
    id: "add_text_modality_id",
    label: "Text"
}];


const TextForm = formFactory(textFormFields, getTopDownRenderer());


export default function AdvancedMessageConstructor() {
    const ADD_TEXT = "add_text";
    const ADD_IMAGE = "add_image";
    const ADD_CODE = "add_code";

    const [mode, setMode] = useState(null);
    const [parent, setParent] = useState(null);
    const [modalities, setModalities] = useState([]);

    async function createAction() {
        let parentId;
        if (parent === null) {
            const responseData = await createMixedModality();
            parentId = responseData.id;
            setParent(parentId);
        } else {
            parentId = parent;
        }
        const action = createTextModality.bind(null, parentId);
        return await action(...arguments);
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

    const AddTextForm = makeCreateForm(TextForm, createAction);

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
                <OutlineButton>Add image</OutlineButton>
                <OutlineButton>Add code</OutlineButton>
            </div>

            <Modal show={mode === ADD_TEXT} onClose={() => setMode(null)}>
                <div className="p-6">
                    <AddTextForm onSuccess={handleSuccessfulTextSubmission} />
                </div>
            </Modal>
        </div>
    );
}

function ModalityMixturePanel({ mixture, onSuccessfulUpdate, onSuccessfulDelete }) {
    const items = mixture.map((modData, idx) => {
        const { modality_type, ...rest } = modData;
        let item;
        if (modality_type === "text") {
            item = <TextModality 
                        data={modData}
                        onSuccessfulUpdate={onSuccessfulUpdate}
                        onSuccessfulDelete={onSuccessfulDelete} />;
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
        onSuccessfulUpdate(data.id, result);
        return result;
    }

    async function deleteAction() {
        const result = await deleteTextModality(...arguments);
        onSuccessfulDelete(data.id, result);
        return result;
    }

    const EditTextForm = makeEditForm(TextForm, updateAction);

    const bodySection = (
        <div className="p-2 border rounded-lg shadow-sm bg-white">{data.text}</div>
    );
    return (
        <PanelItem
            data={data}
            editComponent={EditTextForm}
            deleteAction={deleteAction}
            headerSection={<div></div>}
            bodySection={bodySection} />
    );
}