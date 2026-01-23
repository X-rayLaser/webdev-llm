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
            dispatch({ type: "response_event", task_id, sse_event: payload.data.sse_event });
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
    let text = entry.text || "";
    let startId = entry.thinkingStartId;
    let endId = entry.thinkingEndId;
    let initialClock = entry.initialClock;
    let tokenCount = entry.tokenCount;
    let elapsedSeconds = (new Date() - initialClock) / 1000;

    if (startId === null) {
        startId = 0;
        endId = 0;
    } else if (endId === null) {
        endId = text.length;
    }

    const thoughts = text.substring(startId, endId);
    const spokenText = text.substring(endId, text.length);
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
    return <GeneratingMessage task_id={task_id} thoughts={thoughts} spokenText={spokenText} speed={genSpeed} />;
}

function GeneratingMessage({ task_id, thoughts, spokenText, speed }) {
    let innerHtml = {
        __html: renderMarkdown(spokenText)
    };

    const roundingClass = thoughts || spokenText ? "rounded-t-lg" : "rounded-lg";
    return (
        <div className="rounded-lg shadow-lg">
            <h4 className={`border-2 border-indigo-900 p-4 font-semibold text-lg bg-indigo-600 text-white ${roundingClass}`}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span className="ml-2">Generating a message at {speed} t/s</span>
            </h4>
            {(thoughts || spokenText) && (
                <div className="border-x-2 border-b-2 border-indigo-900 p-4 bg-blue-100 rounded-b-lg">
                    {thoughts && <div className="mb-2"><CotPanel title="Thinking..." text={thoughts} /></div>}
                    {spokenText && (
                        <div className="leading-loose text-lg">
                            <div dangerouslySetInnerHTML={innerHtml} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function messageGenerationsReducer(prevMessages, action) {
    const tableCopy = { ...prevMessages };
    const task_id = action.task_id;
    switch (action.type) {
        case "generation_started":
            return createTextGenerationEntry(prevMessages, task_id);
        case "token_arrived":
            return incrementTableValue(prevMessages, action.task_id, action.token);
        case "generation_ended":
            return removeTableEntry(prevMessages, action.task_id);
        case "thinking_started":
            // typically, thinking precedes the spoken part
            tableCopy[task_id].thinkingStartId = 0;

            console.log("thinking_started!", tableCopy)
            return tableCopy;
        case "thinking_ended":
            let msg = prevMessages[task_id].text || "";
            tableCopy[task_id] = {
                ...tableCopy[task_id],
                thinkingEndId: msg.length
            };
            return tableCopy;
        default:
            return prevMessages;
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
            text: "",
            thinkingStartId: null,
            thinkingEndId: null,
            initialClock: new Date(),
            tokenCount: 0
        };
    }
    return res;
}

function createTextGenerationEntry(table, key) {
    const tableCopy = { ...table };
    tableCopy[key] = {
        text: "",
        thinkingStartId: null,
        thinkingEndId: null,
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
