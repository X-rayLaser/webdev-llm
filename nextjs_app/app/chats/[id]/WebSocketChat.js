"use client"
import React, { useState, useEffect, useReducer } from "react";
import NewMessageForm from "./NewMessageForm";
import { RunningOperationsList } from "./running_ops";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { renderMarkdown } from "@/app/utils";
import { getRandomInt, getHostNameOrLocalhost, WebSocketManager,
    captureAndPlaySpeech, BufferringAudioAutoPlayer
} from "@/app/utils";
import { Alert } from "@/app/components/alerts";
import { CotPanel } from "../CotPanel";


export default function WebSocketChat({
        chat, messages, previousMessage, currentPreset, configuration, operations 
}) {
    const initialMessages = buildTextGenerationTable(operations, "message");
    const titles = buildOperationsTable(operations, "chat_title");
    const pictures = buildOperationsTable(operations, "chat_picture");

    const [messageGenerationsTable, dispatch] = useReducer(messageGenerationsReducer, initialMessages);

    const [titleGenerationsTable, setTitleGenerationsTable] = useState(titles);
    const [imageGenerationsTable, setImageGenerationsTable] = useState(pictures);
    const [errors, setErrors] = useState([]);

    const router = useRouter();

    let bufferingPlayer = new BufferringAudioAutoPlayer(previousMessage.tts_text);

    function socketListener(event) {
        const payload = JSON.parse(event.data);
        const task_id = payload.data.task_id;

        const createEntryFuncion = prevTable => createTableEntry(prevTable, task_id);
        const removeEntryFunction = prevTable => removeTableEntry(prevTable, task_id);

        if (payload.event_type === "generation_started") {
            setErrors([]);
            dispatch({ type: "generation_started", task_id });
        } else if (payload.event_type === "response_event") {
            dispatch({ type: "response_event", task_id, response_event: payload.data.response_event });
        } else if (payload.event_type === "generation_ended") {
            dispatch({ type: "generation_ended", task_id });
            setErrors(payload.data.generation.errors);
            router.refresh();
        } else if (payload.event_type === "chat_title_generation_started") {
            setTitleGenerationsTable(createEntryFuncion);
        } else if (payload.event_type === "chat_title_generation_ended") {
            setTitleGenerationsTable(removeEntryFunction);
            router.refresh();
        } else if (payload.event_type === "chat_image_generation_started") {
            setImageGenerationsTable(createEntryFuncion);
        } else if (payload.event_type === "chat_image_generation_ended") {
            setImageGenerationsTable(removeEntryFunction);
            router.refresh();
        } else if (payload.event_type === 'speech_sample_arrived') {
            bufferingPlayer.put(payload.data);
        } else if (payload.event_type === 'end_of_speech') {
            if (!bufferingPlayer.playing) {
                bufferingPlayer.playback();
            }
        } else {
            console.warn("unknown event type ", payload.event_type);
        }
    }

    useEffect(() => {
        const hostName = getHostNameOrLocalhost(window);

        const manager = new WebSocketManager(hostName, socketListener);
        manager.connect();

        return () => {
            manager.close();
            bufferingPlayer.stop();
            bufferingPlayer = new BufferringAudioAutoPlayer(previousMessage.tts_text);
            
        };
    }, []);

    const messagesInProgress = Object.entries(messageGenerationsTable).map(
        ([task_id, entry]) => <MessagePreview key={task_id} task_id={task_id} entry={entry} />
    );

    const inProgress = messagesInProgress.length > 0;

    const titleGeneration = Object.keys(titleGenerationsTable).length > 0;
    const imageGeneration = Object.keys(imageGenerationsTable).length > 0;
 
    const chatTitle = chat.name.length < 200 ? chat.name : chat.name.substring(0, 200) + "...";

    return (
        <div>
            {titleGeneration && <LoadingMessage text="Generating a title for a chat..." />}
            {imageGeneration && <LoadingMessage text="Generating an image for a chat..." />}

            <div className="flex flex-col gap-4 justify-around">{messages}</div>

            {errors && errors.length > 0 && (
                <div className="flex flex-col gap-4 mt-4">
                    {errors.map((error, idx) => (
                        <Alert key={idx} text={error} level="danger" size="lg" />
                    ))}
                </div>
            )}
            
            {!inProgress && (
                <div className="mt-4">
                    <NewMessageForm chat={chat} previousMessage={previousMessage}
                        preset={currentPreset} configuration={configuration}
                    />
                </div>
            )}
            
            {inProgress && (
                <div className="mt-4 mb-4 flex flex-col gap-4">{messagesInProgress}</div>
            )}
        </div>
    );
}

function LoadingMessage({ text }) {
    return (
        <div className="bg-sky-800 border-2 text-white font-semibold border-sky-900 rounded-sm shadow-lg p-2 mb-2 w-80">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span className="ml-2">{text}</span>
        </div>
    );
}

function MessagePreview({ task_id, entry }) {
    let items = entry.items;
    let initialClock = entry.initialClock;
    let tokenCount = entry.tokenCount;
    let elapsedSeconds = (new Date() - initialClock) / 1000;

    const genSpeed = Math.round(tokenCount / elapsedSeconds);

    if (tokenCount === 0) {
        return (
            <div className="shadow-lg">
                <h4 className={`border-2 border-sky-900 p-4 font-semibold text-lg bg-sky-600 text-white rounded-lg`}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span className="ml-2">Preparing...</span>
                </h4>
            </div>
        );
    }
    return <GeneratingMessage task_id={task_id} items={items} speed={genSpeed} />;
}

function GeneratingMessage({ task_id, items, speed }) {
    const allItems = [...items.completed, ...items.inProgress];

    const roundingClass = allItems.length > 0 ? "rounded-t-lg" : "rounded-lg";

    // Removes function_call items that have corresponding function_call_output items
    function removeCompletedFunctionCalls(items) {
        const outputCallIds = new Set(
            items
                .filter(item => item.type === "function_call_output" && item.call_id)
                .map(item => item.call_id)
        );
        return items.filter(item => {
            if (item.type === "function_call" && item.call_id && outputCallIds.has(item.call_id)) {
                return false;
            }
            return true;
        });
    }

    const cleanedItems = removeCompletedFunctionCalls(allItems);

    return (
        <div className="rounded-lg shadow-lg">
            <h4 className={`border-2 border-indigo-900 p-4 font-semibold text-lg bg-indigo-600 text-white ${roundingClass}`}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span className="ml-2">Generating a message at {speed} t/s</span>
            </h4>
            {cleanedItems && cleanedItems.length > 0 && (
                <div className="border-x-2 border-b-2 border-indigo-900 p-4 bg-blue-50 rounded-b-lg">
                    {cleanedItems.map((item, idx) => {
                        if (item.type === "reasoning") {
                            return <ReasoningItem key={idx} item={item} />;
                        }
                        if (item.type === "message") {
                            return <TextItem key={idx} item={item} />;
                        }

                        if (item.type === "function_call" || item.type === "function_call_output") {
                            return <FunctionCallItem key={idx} item={item} />;
                        }

                        
                        // fallback for unknown types
                        return null;
                    })}
                </div>
            )}
        </div>
    );
}



function TextItem({ item }) {
    let content = item.content;
    if (Array.isArray(content)) {
        content = content.join("");
    }
    return (
        <div className="leading-loose text-lg">
            <div dangerouslySetInnerHTML={{
                __html: renderMarkdown(content)
            }} />
        </div>
    )
}

export function ReasoningItem({ item }) {
    let content = item.content;
    if (Array.isArray(content)) {
        content = content.join("");
    }

    return (
        <div className="mb-2">
            <CotPanel title="Thinking..." text={content} />
        </div>
    );
}

export function FunctionCallItem({ item, showSpinner=true }) {
    const { name, arguments: args, output } = item;

    let argsObject;
    try {
        argsObject = typeof args === "string" ? JSON.parse(args) : args;
    } catch (e) {
        console.error(e);
    }

    return (
        <div className="bg-slate-100 border-l-4 border-blue-400 shadow rounded p-4 flex items-start my-3">
            {showSpinner && (
                <div className="mr-3 mt-1 text-blue-500">
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}
            <div className="flex-1">
                {name && (
                    <div className="font-semibold text-blue-800 text-base">
                        <span>Function:</span>
                        <span className="ml-2 tracking-wide">{name}</span>
                    </div>
                )}
                <div className="mt-2 pl-1">
                    {argsObject && Object.keys(argsObject).length > 0 ? (
                        <div className="bg-slate-200 w-72 rounded p-2 text-sm overflow-x-auto">
                            <div className="font-semibold mb-1 text-slate-700">Arguments:</div>
                            <div>
                                {Object.entries(argsObject).map(([key, value]) => (
                                    <div key={key} className="flex flex-row items-start bg-slate-100 rounded p-2 mb-2">
                                        <span className="pr-2 font-mono text-slate-600 whitespace-nowrap">{key}:</span>
                                        <pre className="m-0 inline-block whitespace-pre-wrap break-words text-slate-700">
                                            {typeof value === 'object'
                                                ? JSON.stringify(value, null, 2)
                                                : String(value)}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-200 w-72 rounded p-2 text-sm font-semibold mb-1 text-slate-700">
                            Arguments: None
                        </div>
                    )}
                </div>
                {output !== undefined && (
                    <div className="mt-2 pl-1">
                        <div className="text-green-800 font-semibold">Result:</div>
                        <pre className="bg-green-100 rounded p-2 text-sm overflow-x-auto whitespace-pre-wrap break-words">
                            {output}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}


function messageGenerationsReducer(prevGenerations, action) {
    const tableCopy = { ...prevGenerations };
    const task_id = action.task_id;
    switch (action.type) {
        case "generation_started":
            return createTextGenerationEntry(prevGenerations, task_id);
        case "generation_ended":
            return removeTableEntry(prevGenerations, action.task_id);
        case "response_event":
            return processResponseEvent(prevGenerations, action.task_id, action.response_event);
        default:
            return prevGenerations;
    }
}

function buildOperationsTable(operations, generationType) {
    const ops = operations.filter(op => op.generation_type === generationType);

    const res = {};
    for (let msg of ops) {
        res[msg.task_id] = "";
    }
    return res;
}

function buildTextGenerationTable(operations, generationType) {
    const ops = operations.filter(op => op.generation_type === generationType);

    const res = {};
    for (let msg of ops) {
        res[msg.task_id] = {
            items: [],
            initialClock: new Date(),
            tokenCount: 0
        };
    }
    return res;
}

function createTextGenerationEntry(table, key) {
    const tableCopy = { ...table };
    tableCopy[key] = {
        items: {
            inProgress: [],
            completed: []
        },
        initialClock: new Date(),
        tokenCount: 0
    };
    return tableCopy;
}


function createTableEntry(table, key) {
    const tableCopy = { ...table };
    tableCopy[key] = "";
    return tableCopy;
}

function removeTableEntry(table, key) {
    const tableCopy = { ...table };
    delete tableCopy[key];
    return tableCopy;
}

function processResponseEvent(prevGenerations, task_id, sse_event) {
    console.log('sse event', sse_event)

    // deep copy
    const newGenerations = structuredClone(prevGenerations);
    const entry = newGenerations[task_id];
    let isChanged = false;

    // TODO: function_call_output event/item type
    switch (sse_event.type) {
        case "response.completed": {
            if (entry.items && entry.items.inProgress && entry.items.completed) {
                entry.items.completed = [...entry.items.completed, ...entry.items.inProgress];
                entry.items.inProgress = [];
            }
        }
        case "response.output_item.added": {
            isChanged = processItemAdded(entry, sse_event);
            break;
        }
        case "response.output_item.done": {
            isChanged = processFunctionCall(entry, sse_event);
            break;
        }
        case "response.content_part.added": {
            isChanged = processPartAdded(entry, sse_event);
            break;
        }
        case "response.output_text.delta":
        case "response.reasoning_text.delta": {
            isChanged = processTextDelta(entry, sse_event);
            break;
        }
        case "response.custom_type.function_call_result": {
            const newItem = findItem(entry, sse_event);
            newItem.output = sse_event.item.output;
            newItem.type = sse_event.item.type;
            entry.items = [...entry.items, newItem];
            break;
        }
        default:
            return prevGenerations;
    }

    if (isChanged) {
        newGenerations[task_id] = entry;
        return newGenerations;
    }
    return prevGenerations;
}

function processItemAdded(entry, sse_event) {
    const newItem = { ...sse_event.item };
    entry.items.inProgress = [...entry.items.inProgress, newItem];
    return true;
}

function processPartAdded(entry, sse_event) {
    // todo: watch out for content_index (may not necessarily be appended to the end)
    const { output_index, content_index } = sse_event;
    const origItem = findItem(entry, sse_event);

    if (!origItem) {
        return false;
    }

    if (origItem.type === "function_call") {
        return false;
    }

    if (!origItem.content) origItem.content = [];
    // we just initialize newlly added part to empty string
    origItem.content = [...origItem.content, ""];
    entry.items.inProgress = immutableReplace(entry.items.inProgress, output_index, origItem);
    return true;

}

function processTextDelta(entry, sse_event) {
    const { output_index, content_index, delta } = sse_event;
    const origItem = findItem(entry, sse_event);

    if (!origItem) {
        return false;
    }
    
    const newContent = origItem.content[content_index] + delta || "";

    const modifiedItem = {
        ...origItem,
        content: immutableReplace(origItem.content, content_index, newContent)
    };

    entry.items.inProgress = immutableReplace(entry.items.inProgress, output_index, modifiedItem);

    entry.tokenCount = entry.tokenCount + 1;
    return true;

}

function processFunctionCall(entry, sse_event) {
    const origItem = findItem(entry, sse_event);

    if (origItem && origItem.type === "function_call") {
        origItem.arguments = sse_event.item.arguments;
        return true;
    }
    return false;
}

function findItem(entry, sse_event) {
    const { output_index, content_index } = sse_event;
    if (output_index >= 0 && entry.items.inProgress[output_index]) {
        return { ...entry.items.inProgress[output_index] };
    }
    return null;
}

function immutableReplace(arr, pos, element) {
    return [
        ...arr.slice(0, pos),
        element,
        ...arr.slice(pos + 1)
    ];
}