"use client"
import React, { useState, useEffect } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil, faCircleChevronLeft, faCircleChevronRight, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { cloneModality, createMultimediaMessage, switchBranch } from "@/app/actions";
import { fetchMessage } from "@/app/data";
import TabContainer from "@/app/components/TabContainer";
import PreviewComponent from "./PreviewComponent";

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
    const [currentMessage, setCurrentMessage] = useState(message);

    async function handleBuildFinished() {
        const data = await fetchMessage(currentMessage.id);
        setCurrentMessage(data);
    }
    
    useEffect(() => {
        //todo: check if this is necessary
        setCurrentMessage(message)
    }, [message]);

    const tabs = [
        { key: 'Raw', label: 'Raw', content: <RawMessage message={currentMessage} /> },
        { key: 'Code', label: 'Code', content: <div>Content for Tab 2</div> },
        { key: 'Preview', label: 'Preview', content: (
            <PreviewComponent message={currentMessage} onBuildFinished={handleBuildFinished} />
        )},
    ];
    return (
        <TabContainer tabs={tabs} />
    );
}

export function RawMessage({ message }) {
    const [editMode, setEditMode] = useState(false);
    const [modality, setModality] = useState(message.content_ro);
    const [switching, setSwitching] = useState(false);

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

    const previousMessage = message.parent;
    let role;
    let formAction;
    if (previousMessage === null || previousMessage === undefined) {
        role = "user";
        formAction = function() {};
    } else {
        const action = createMultimediaMessage.bind(null, message.role, previousMessage);
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

    function handleLeftArrowClick() {
        setSwitching(true);
        switchBranch(message, message.branchIndex - 1).finally(() => setSwitching(false));
    }

    function handleRightArrowClick() {
        setSwitching(true);
        switchBranch(message, message.branchIndex + 1).finally(() => setSwitching(false));
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
            {!editMode && previousMessage && (
                <div>
                    {switching && (
                        <span>
                            <FontAwesomeIcon icon={faSpinner} spin size="lg" />
                        </span>
                    )}
                    {message.branches > 1 && !switching && (
                        <div>
                            <div className="flex gap-2 text-blue-500 text-lg">
                                <button 
                                    onClick={handleLeftArrowClick}
                                    disabled={message.branchIndex === 0}
                                >
                                    <FontAwesomeIcon icon={faCircleChevronLeft} />
                                </button>
                                <span>
                                    {message.branchIndex + 1} / {message.branches}
                                </span>
                                <button
                                    onClick={handleRightArrowClick}
                                    disabled={message.branchIndex === message.branches - 1}
                                >
                                    <FontAwesomeIcon icon={faCircleChevronRight} />
                                </button>
                            </div>
                        </div>
                    )}
                    {!switching && (
                        <button onClick={handleEditClick}>
                            Edit <FontAwesomeIcon icon={faPencil} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}