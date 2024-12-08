"use client"
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { createMultimediaMessage } from "@/app/actions";
import { ButtonDropdown } from "@/app/components/buttons";


export default function NewMessageForm({ previousMessage }) {
    const role = previousMessage.role === "assistant" ? "user" : "assistant";

    const formAction = createMultimediaMessage.bind(null, role, previousMessage.id);

    const actions = [
        { name: "action1", label: "Action 1", onSelect: () => console.log("Action 1 selected") },
        { name: "action2", label: "Action 2", onSelect: () => console.log("Action 2 selected") },
    ];

    return (
        <div>
            <ButtonDropdown actions={actions} />
            <AdvancedMessageConstructor
                formAction={formAction}
            />
        </div>
    );
}