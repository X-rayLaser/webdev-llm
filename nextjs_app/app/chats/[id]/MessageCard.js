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
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { CotPanel } from "../CotPanel";


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
        <div className="border-2 border-sky-700">
            <RawMessage message={currentMessage} generationConfig={generationConfig} />
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

    const decoratedModality = mergeFunctionCalls(
        decorateWithSources(modality, sources)
    );

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
            <div className="bg-slate-200">
                {editMode ? (
                    <AdvancedMessageConstructor
                        formAction={formAction}
                        rootModality={decoratedModality}
                        onCancel={() => setEditMode(false)}
                        generationConfig={generationConfig}
                    />
                ) : (
                    <div>
                        {message.thoughts && (<div className="px-4 pt-4">
                            <CotPanel text={message.thoughts} />
                        </div>)}
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

    let author;
    if (message.role === "assistant" && message.metadata && message.metadata.model_name) {
        author = message.metadata.model_name;
    } else {
        author = capitalize(message.role);
    }

    return (
        <div className="bg-slate-200 px-4 py-2 flex justify-between items-center text-sky-800 border-t border-stone-400">
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
                            <span className="ml-2">{author}</span>
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


function mergeFunctionCalls(rootModality) {
    // Function to test if a modality is for function calling
    function isFunctionCallingModality(modality, item_type) {
        return (
            modality &&
            modality.modality_type === "oai_item" &&
            modality.oai_item &&
            modality.oai_item.type === item_type &&
            modality.oai_item.call_id
        );
    }

    const functionCallArgs = Object.fromEntries(
        rootModality.mixture
            .filter(mod => isFunctionCallingModality(mod, "function_call"))
            .map(mod => [mod.oai_item.call_id, mod.oai_item.arguments])
    );

    // Exclude function_call modalities for which there is a function_call_output with the same call_id
    const functionCallOutputCallIds = new Set(
        rootModality.mixture
            .filter(mod => isFunctionCallingModality(mod, "function_call_output"))
            .map(mod => mod.oai_item.call_id)
    );
    const filteredMixture = rootModality.mixture.filter(mod => {
        if (isFunctionCallingModality(mod, "function_call")) {
            return !functionCallOutputCallIds.has(mod.oai_item.call_id);
        }
        return true;
    });

    const merged = filteredMixture.map(mod => {
        if (isFunctionCallingModality(mod, "function_call_output")) {

            return {
                ...mod,
                oai_item: {
                    ...mod.oai_item,
                    arguments: functionCallArgs[mod.oai_item.call_id]
                }
            };
        }
        
        return mod;
    });
    return {
        ...rootModality,
        mixture: merged
    };
}