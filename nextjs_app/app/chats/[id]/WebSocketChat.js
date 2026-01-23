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

    const roundingClass = items.length > 0 ? "rounded-t-lg" : "rounded-lg";
    return (
        <div className="rounded-lg shadow-lg">
            <h4 className={`border-2 border-indigo-900 p-4 font-semibold text-lg bg-indigo-600 text-white ${roundingClass}`}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span className="ml-2">Generating a message at {speed} t/s</span>
            </h4>
            {items && items.length > 0 && (
                <div className="border-x-2 border-b-2 border-indigo-900 p-4 bg-blue-50 rounded-b-lg">
                    {items.map((item, idx) => {
                        if (item.type === "reasoning") {
                            return <ReasoningItem key={idx} item={item} />;
                        }
                        if (item.type === "message") {
                            return <TextItem key={idx} item={item} />;
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

function ReasoningItem({ item }) {
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
        items: [],
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

function incrementTableValue(table, key, newValue) {
    const tableCopy = { ...table };
    const { text="", tokenCount=0, initialClock } = {...tableCopy[key]};

    tableCopy[key] = {
        ...tableCopy[key],
        text: text + newValue,
        tokenCount: text === "" ? 0 : tokenCount + 1,
        // ignore time passed till first token
        initialClock: text === "" ? new Date() : initialClock
    };

    return tableCopy;
}

function removeTableEntry(table, key) {
    const tableCopy = { ...table };
    delete tableCopy[key];
    return tableCopy;
}

function processResponseEvent(prevGenerations, task_id, sse_event) {
    console.log('sse event', sse_event)
    const newGenerations = { ...prevGenerations };
    const entry = { ...(newGenerations[task_id] || { items: [], initialClock: new Date(), tokenCount: 0 }) };
    let isChanged = false;

    switch (sse_event.type) {
        case "response.output_item.added": {
            const newItem = { ...sse_event.item };
            entry.items = [...entry.items, newItem];
            isChanged = true;
            break;
        }
        case "response.content_part.added": {
            // todo: watch out for content_index (may not necessarily be appended to the end)
            const { output_index, content_index } = sse_event;
            if (entry.items[output_index]) {
                const origItem = { ...entry.items[output_index] };

                if (origItem.type === "function_call") {
                    return prevGenerations;
                }

                if (!origItem.content) origItem.content = [];
                // we just initialize newlly added part to empty string
                origItem.content = [...origItem.content, ""];
                entry.items = [
                    ...entry.items.slice(0, output_index),
                    origItem,
                    ...entry.items.slice(output_index + 1)
                ];
                isChanged = true;
            }
            break;
        }
        case "response.output_text.delta": {
            const { output_index, content_index, delta } = sse_event;
            let index = typeof output_index === "number" ? output_index : entry.items.length - 1;
            if (index >= 0 && entry.items[index]) {
                const origItem = { ...entry.items[index] };

                entry.items = [
                    ...entry.items.slice(0, index),
                    {   ...origItem,
                        content: [
                            ...origItem.content.slice(0, content_index),
                            origItem.content[content_index] + delta || "",
                            ...origItem.content.slice(content_index + 1),
                        ]
                    },
                    ...entry.items.slice(index + 1)
                ];
                entry.tokenCount = entry.tokenCount + 1;
                isChanged = true;
            }
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
