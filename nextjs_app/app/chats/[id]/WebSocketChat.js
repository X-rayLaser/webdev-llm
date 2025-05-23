"use client"
import React, { useState, useEffect } from "react";
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


export default function WebSocketChat({
        chat, messages, previousMessage, currentPreset, configuration, operations 
}) {
    const messageTexts = buildOperationsTable(operations, "message");
    const titles = buildOperationsTable(operations, "chat_title");
    const pictures = buildOperationsTable(operations, "chat_picture");

    const [messageGenerationsTable, setMessageGenerationsTable] = useState(messageTexts);
    const [titleGenerationsTable, setTitleGenerationsTable] = useState(titles);
    const [imageGenerationsTable, setImageGenerationsTable] = useState(pictures);
    const [errors, setErrors] = useState([]);
    const router = useRouter();

    let bufferingPlayer = new BufferringAudioAutoPlayer(previousMessage.tts_text);

    function socketListener(event) {
        const payload = JSON.parse(event.data);
        const task_id = payload.data.task_id;

        const createEntryFuncion = prevTable => createTableEntry(prevTable, task_id);
        const removeEntryFunction = prevTable => removeTableEntry(prevTable, task_id)

        if (payload.event_type === "generation_started") {
            setErrors([]);
            setMessageGenerationsTable(createEntryFuncion);
        } else if (payload.event_type === "token_arrived") {
            setMessageGenerationsTable(
                prevTable => incrementTableValue(prevTable, task_id, payload.data.token)
            );
        } else if (payload.event_type === "generation_ended") {
            setMessageGenerationsTable(removeEntryFunction);
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
        ([task_id, text], idx) => <GeneratingMessage key={idx} task_id={task_id} text={text} />
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

function GeneratingMessage({ task_id, text }) {
    let innerHtml = {
        __html: renderMarkdown(text)
    };

    const roundingClass = text ? "rounded-t-lg" : "rounded-lg";
    return (
        <div className="rounded-lg shadow-lg">
            <h4 className={`border-2 border-indigo-900 p-4 font-semibold text-lg bg-indigo-600 text-white ${roundingClass}`}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span className="ml-2">Generating a message...</span>
            </h4>
            {text && (
                <div className="border-x-2 border-b-2 border-indigo-900 p-4 leading-loose text-lg bg-blue-100 rounded-b-lg">
                    <div dangerouslySetInnerHTML={innerHtml} />
                </div>
            )}
        </div>
    );
}

function buildOperationsTable(operations, generationType) {
    const ops = operations.filter(op => op.generation_type === generationType);

    const res = {};
    for (let msg of ops) {
        res[msg.task_id] = "";
    }
    return res;
}

function createTableEntry(table, key) {
    const tableCopy = { ...table };
    tableCopy[key] = "";
    return tableCopy;
}

function incrementTableValue(table, key, newValue) {
    const tableCopy = { ...table };
    const currentValue = tableCopy[key] || "";
    tableCopy[key] = currentValue + newValue;
    return tableCopy;
}

function removeTableEntry(table, key) {
    const tableCopy = { ...table };
    delete tableCopy[key];
    return tableCopy;
}
