"use client"

import React, { useState, useEffect } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import TabContainer from "@/app/components/TabContainer";
import SimpleMessageConstructor from "./SimpleMessageConstructor";
import { createMultimediaMessage, startMessageGeneration } from "@/app/actions";
import { ButtonDropdown } from "@/app/components/buttons";
import { Tooltip } from "@/app/components/tooltips";
import { fields } from "@/app/configuration/PresetPanel";
import { TextField, TextArea, jsonPlaceholder } from "@/app/components/common-forms";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

const formFields = [...fields, {
    name: "model_name",
    component: TextField,
    id: "generate_message_form_model_name",
    label: "Model name",
}, {
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
            <div className="mb-4">{formFields.model_name}</div>
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

export default function NewMessageForm({ chat, previousMessage, preset, configuration }) {
    const CREATE = "create";
    const GENERATE = "generate";
    const role = previousMessage.role === "assistant" ? "user" : "assistant";

    const [currentAction, setCurrentAction] = useState(role === "user" ? CREATE : GENERATE);

    const formAction = createMultimediaMessage.bind(null, role, previousMessage.id);

    const actions = [
        { name: "generation", label: "Generate message", onSelect: () => setCurrentAction(GENERATE) },
        { name: "create", label: "Create message", onSelect: () => setCurrentAction(CREATE) },
    ];

    const defaultAction = currentAction === GENERATE ? {...actions[0]} : {...actions[1]};

    const Form = formFactory(formFields, renderForm);
    const generateNextjsAction = startMessageGeneration.bind(null, chat.id, previousMessage.id);

    const defaults = {
        model_name: configuration.llm_model || "",
        ...preset
    };

    const GenerateMessageForm = makeCreateForm(Form, generateNextjsAction, defaults);

    useEffect(() => {
        setCurrentAction(previousMessage.role === "user" ? GENERATE : CREATE);
    }, [previousMessage])

    function handleSuccess({ success, responseData }) {
        setCurrentAction(GENERATE);
    }

    const constructorTabs = [
        { key: 'Simple', label: 'Simple', content: (
            <div className="p-4">
                <SimpleMessageConstructor chat={chat} previousMessage={previousMessage} generationConfig={defaults} />
            </div>
        )},
        { key: 'Advanced', label: 'Advanced', content: (
            <AdvancedMessageConstructor formAction={formAction} generationConfig={defaults} />
        )},
    ];

    return (
        <div className="mb-4">
            <div className="flex gap-4 items-center mb-4">
                <div>Choose action: </div>
                <ButtonDropdown actions={actions} defaultAction={defaultAction} />
                <Tooltip content="Choose whether to use LLM to generate a message or to write it by yourself">
                    <FontAwesomeIcon icon={faCircleQuestion} size="lg" />
                </Tooltip>
            </div>

            <div>
                {currentAction === CREATE && (
                    <div className="rounded-md shadow-md border">
                        <TabContainer tabs={constructorTabs} />
                    </div>
                )}
                {currentAction === GENERATE && (
                    <div className="rounded-md shadow-md border p-4">
                        <GenerateMessageForm onSuccess={handleSuccess} />
                    </div>
                )}
            </div>
        </div>
    );
}