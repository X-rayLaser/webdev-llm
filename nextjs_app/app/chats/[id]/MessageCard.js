"use client"
import React, { useState, useEffect } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { cloneModality, createMultimediaMessage } from "@/app/actions";

function decorateWithSources(modalityObject, sourceFiles) {
    if (modalityObject.modality_type === "code") {
        const matches = sourceFiles.filter(f => f.file_path === modalityObject.file_path);
        const result = (
            matches.length > 0 ? { ...modalityObject, code: matches[0].content } : { ...modalityObject }
        );

        return result;
    } else if (modalityObject.modality_type === "mixture") {
        const mixture = modalityObject.mixture.map(mod => decorateWithSources(mod, sourceFiles));
        return {
            ...modalityObject,
            mixture
        };
    } else {
        return { ...modalityObject };
    }
}

export default function MessageCard({ message }) {
    const [editMode, setEditMode] = useState(false);
    const [modality, setModality] = useState(message.content_ro);

    useEffect(() => {
        if (message) {
            setModality(message.content_ro);
        }
    }, [message]);

    const sources = (
        message?.active_revision?.src_tree || 
        (message.revisions.length === 1 && message.revisions[0]?.src_tree) ||
        []
    );

    const decoratedModality = decorateWithSources(modality, sources);
    console.log("message", message)
    const previousMessage = message.parent;
    let role;
    let formAction;
    if (previousMessage === null || previousMessage === undefined) {
        role = "user";
        formAction = function() {};
    } else {
        role = previousMessage.role === "assistant" ? "user" : "assistant";
        const action = createMultimediaMessage.bind(null, role, previousMessage.id);
        formAction = function () {
            return action(...arguments).then(result => {
                setEditMode(false);
                return result;
            });
        }
    }
    
    async function handleEditClick() {
        const result = await cloneModality(modality.id);
        if (result.success) {
            setEditMode(true);
            setModality(result.responseData);
        } else {
            console.error("Error:", result);
        }
    }

    return (
        <div>
            <div className="p-4 border rounded-lg shadow-lg bg-sky-700">
                {editMode ? (
                    <AdvancedMessageConstructor
                        formAction={formAction}
                        rootModality={decoratedModality}
                    />
                ) : (
                    <ModalityViewer modalityObject={decoratedModality} showControls={false} />
                )}
            </div>
            {previousMessage && (
                <button onClick={handleEditClick}>
                    Edit <FontAwesomeIcon icon={faPencil} />
                </button>
            )}
        </div>
    );
}