"use client"
import React, { useState, useEffect } from "react";
import NewMessageForm from "./NewMessageForm";
import { RunningOperationsList } from "./running_ops";
import { useRouter } from "next/navigation";

const socket = new WebSocket(`ws://localhost:9000`);

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

let n = getRandomInt(Math.pow(2, 31));
let socketSessionId = `${n}`;
socketSessionId = 0;
socket.addEventListener("open", (event) => {
    socket.send(socketSessionId);
});

export default function WebSocketChat({ chat, messages, previousMessage, currentPreset, operations }) {
    const [generationsTable, setGenerationsTable] = useState({});
    const router = useRouter();

    function socketListener(event) {
        const payload = JSON.parse(event.data);

        console.log("EVENT!", event, payload);
        const task_id = payload.task_id;

        if (payload.event_type === "generation_started") {
            setGenerationsTable(prevTable => {
                const tableCopy = { ...prevTable };
                tableCopy[task_id] = "";
                return tableCopy;
            });
        } else if (payload.event_type === "token_arrived") {
            setGenerationsTable(prevTable => {
                const tableCopy = { ...prevTable };
                const currentValue = tableCopy[task_id] || "";
                tableCopy[task_id] = currentValue + payload.data.token;
                return tableCopy;
            });
        } else if (payload.event_type === "generation_ended") {
            setGenerationsTable(prevTable => {
                const tableCopy = { ...prevTable };
                delete tableCopy[task_id];
                return tableCopy;
            });

            router.refresh();
        } else {
            console.warn("unknown event type ", payload.event_type);
        }
        
    }

    useEffect(() => {
        console.log(operations);
        socket.addEventListener("message", socketListener);

        return () => {
            socket.removeEventListener("message", socketListener);
        };
    }, []);

    const messagesInProgress = Object.entries(generationsTable).map(
        ([task_id, text], idx) => <GeneratingMessage key={idx} task_id={task_id} text={text} />
    );

    const inProgress = messagesInProgress.length > 0;

    return (
        <div>
            <div>{chat.name.substring(0, 100)}...</div>
            <h2>Messages</h2>
            <div className="flex flex-col gap-4 justify-around">{messages}</div>
            
            {!inProgress && (
                <div className="mt-4">
                    <NewMessageForm chat={chat} previousMessage={previousMessage} preset={currentPreset} />
                </div>
            )}
            {inProgress && (
                <div>{messagesInProgress}</div>
            )}
            
            <RunningOperationsList operations={operations}/>
        </div>
    );
}

function GeneratingMessage({ task_id, text }) {
    return (
        <div>
            <h4>Generating message for {task_id}...</h4>
            <div>{text}</div>
        </div>
    );
}