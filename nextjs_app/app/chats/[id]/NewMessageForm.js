"use client"

import React, { useState } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { createMultimediaMessage, startMessageGeneration } from "@/app/actions";
import { ButtonDropdown } from "@/app/components/buttons";
import { Tooltip } from "@/app/components/tooltips";
import { fields } from "@/app/configuration/PresetPanel";
import { TextArea, jsonPlaceholder } from "@/app/components/common-forms";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { getTopDownRenderer } from "@/app/components/fieldset-renderers";

const formFields = [...fields, {
    name: "params",
    component: TextArea,
    id: "generate_message_form_params",
    label: "More params (optional)",
    placeholder: jsonPlaceholder
}];

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

    const Form = formFactory(formFields, getTopDownRenderer());
    const generateNextjsAction = startMessageGeneration.bind(null, chat.id, previousMessage.id);

    const GenerateMessageForm = makeCreateForm(Form, generateNextjsAction, preset);


    return (
        <div>
            <ButtonDropdown actions={actions} defaultAction={actions[0]} />
            <Tooltip content="Choose whether to use LLM to generate a message or to write it by yourself">
                <div className="text-2xl ml-2 bg-yellow-400 w-12 h-12 rounded-full flex justify-items-center text-center">?</div>
            </Tooltip>

            <div className="p-4 rounded-md shadow-md border">
                {currentAction === CREATE && <AdvancedMessageConstructor formAction={formAction} />}
                {currentAction === GENERATE && <GenerateMessageForm />}
            </div>
        </div>
    );
}