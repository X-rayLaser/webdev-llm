"use client"

import React, { useState } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { createMultimediaMessage, startMessageGeneration } from "@/app/actions";
import { ButtonDropdown } from "@/app/components/buttons";
import { Tooltip } from "@/app/components/tooltips";
import { fields } from "@/app/configuration/PresetPanel";
import { TextArea, jsonPlaceholder } from "@/app/components/common-forms";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

const formFields = [...fields, {
    name: "params",
    component: TextArea,
    id: "generate_message_form_params",
    label: "More params (optional)",
    placeholder: jsonPlaceholder
}];

function renderForm(formFields, names, errorMessage, submitButton) {
    const presetElements = fields.filter(
        field => field.name !== "extra_params"
    ).map((field, idx) => (
        <div key={idx} className="mb-4">
            {formFields[field.name]}
        </div>
    ));

    return (
        <div>
            <details>
                <summary className="mb-4 cursor-pointer">Sampling settings</summary>
                <div className="mb-4">{presetElements}</div>
            </details>

            <details>
                <summary className="mb-4 cursor-pointer">Custom sampling params</summary>
                <div className="mb-4">{formFields.extra_params}</div>
            </details>

            <details>
                <summary className="mb-4 cursor-pointer">Custom options</summary>
                <div className="mb-4">{formFields.params}</div>
            </details>

            {errorMessage}
            {submitButton}
        </div>
    );
}

export default function NewMessageForm({ chat, previousMessage, preset }) {
    const CREATE = "create";
    const GENERATE = "generate";
    const [currentAction, setCurrentAction] = useState(GENERATE);
    const role = previousMessage.role === "assistant" ? "user" : "assistant";

    const formAction = createMultimediaMessage.bind(null, role, previousMessage.id);

    const actions = [
        { name: "action1", label: "Generate message", onSelect: () => setCurrentAction(GENERATE) },
        { name: "action2", label: "Create message", onSelect: () => setCurrentAction(CREATE) },
    ];

    const Form = formFactory(formFields, renderForm);
    const generateNextjsAction = startMessageGeneration.bind(null, chat.id, previousMessage.id);

    const GenerateMessageForm = makeCreateForm(Form, generateNextjsAction, preset);

    function handleSuccess({ success, responseData }) {
        setCurrentAction(GENERATE);
    }

    return (
        <div>
            <div className="flex gap-4 items-center mb-4">
                <div>Choose action: </div>
                <ButtonDropdown actions={actions} defaultAction={actions[0]} />
                <Tooltip content="Choose whether to use LLM to generate a message or to write it by yourself">
                    <FontAwesomeIcon icon={faCircleQuestion} size="lg" />
                </Tooltip>
            </div>

            <div className="p-4 rounded-md shadow-md border">
                {currentAction === CREATE && <AdvancedMessageConstructor formAction={formAction} />}
                {currentAction === GENERATE && <GenerateMessageForm onSuccess={handleSuccess} />}
            </div>
        </div>
    );
}