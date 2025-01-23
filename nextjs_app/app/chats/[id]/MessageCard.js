"use client"
import React, { useState, useEffect } from "react";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil, faCircleChevronLeft, 
    faCircleChevronRight, faSpinner, faRobot, faUserTie, faRotate
} from '@fortawesome/free-solid-svg-icons';
import { cloneModality, createMultimediaMessage, switchBranch, regenerateMessage } from "@/app/actions";
import { fetchMessage } from "@/app/data";
import TabContainer from "@/app/components/TabContainer";
import PreviewComponent from "./PreviewComponent";
import { OutlineButton, OutlineButtonSmall } from "@/app/components/buttons";
import { capitalize } from "@/app/utils";
import { Alert } from "@/app/components/alerts";

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

export default function MessageCard({ message, generationConfig }) {
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
        { key: 'Raw', label: 'Raw', content: <RawMessage message={currentMessage} generationConfig={generationConfig} /> },
        //{ key: 'Code', label: 'Code', content: <div>Content for Tab 2</div> },
        { key: 'Preview', label: 'Preview', content: (
            <div className="p-4">
                <PreviewComponent message={currentMessage} onBuildFinished={handleBuildFinished} />
            </div>
        )},
    ];
    return (
        <div>
            <TabContainer tabs={tabs} />
            {message.parent && <Footer message={message} />}
        </div>
    );
}

export function RawMessage({ message, generationConfig }) {
    const [editMode, setEditMode] = useState(false);
    const [modality, setModality] = useState(message.content_ro);
    const [inProgress, setInProgress] = useState(false);

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
        setInProgress(true);
        const result = await cloneModality(modality.id);
        if (result.success) {
            setEditMode(true);
            setModality(result.responseData);
        } else {
            console.error("Error:", result);
        }
        setInProgress(false);
    }

    return (
        <div className="rounded-t">
            <div className="bg-slate-50">
                {editMode ? (
                    <AdvancedMessageConstructor
                        formAction={formAction}
                        rootModality={decoratedModality}
                        onCancel={() => setEditMode(false)}
                        generationConfig={generationConfig}
                    />
                ) : (
                    <div>
                        <ModalityViewer modalityObject={decoratedModality} showControls={false} />

                        {previousMessage && (
                            <div className="pl-4 pb-4">
                                <OutlineButtonSmall onClick={handleEditClick} disabled={inProgress}>
                                    Edit <FontAwesomeIcon icon={faPencil} />
                                    {inProgress && (
                                        <span className="ml-2">
                                            <FontAwesomeIcon icon={faSpinner} spin size="lg" />
                                        </span>
                                    )}
                                </OutlineButtonSmall>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Footer({ message }) {
    const [inProgress, setInProgress] = useState(false);
    const [error, setError] = useState("");

    function handleLeftArrowClick() {
        setInProgress(true);
        switchBranch(message, message.branchIndex - 1).finally(() => setInProgress(false));
    }

    function handleRightArrowClick() {
        setInProgress(true);
        switchBranch(message, message.branchIndex + 1).finally(() => setInProgress(false));
    }

    function handleRegenerate() {
        setInProgress(true);
        setError("");
        regenerateMessage(message.chat, message.parent).then(({ success, responseData }) => {
            if (!success) {
                console.error(responseData);
                setError(responseData.message);
            }
        }).catch(error => {
            console.error(error);
            setError(error);
        }).finally(() => setInProgress(false));
    }

    return (
        <div className="bg-gray-50 px-4 py-2 flex justify-between items-center text-sky-900 border">
            {inProgress && (
                <span>
                    <FontAwesomeIcon icon={faSpinner} spin size="lg" />
                </span>
            )}
            {!inProgress && (
                <div className="flex gap-2">
                    <div>
                        <span className="font-bold text-lg mr-4">
                            <FontAwesomeIcon icon={message.role === "user" ? faUserTie : faRobot} />
                            <span className="ml-2">{capitalize(message.role)}</span>
                        </span>
                    </div>
                </div>
            )}
            {!inProgress &&
                <div className="flex gap-2">
                    <OutlineButtonSmall onClick={handleRegenerate}>
                        <FontAwesomeIcon icon={faRotate} />
                    </OutlineButtonSmall>
                    {error && <Alert text={error} level="danger" size="xs" />}
                    {message.branches > 1 && (
                        <div>
                            <div className="flex gap-2 text-sky-900 text-lg">
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
                </div>
            }
        </div>
    );
}
