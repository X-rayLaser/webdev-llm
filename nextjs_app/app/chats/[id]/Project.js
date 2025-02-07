"use client"
import WebSocketChat from "./WebSocketChat";
import IDE from "./SimpleIDE";
import PillContainer from "@/app/components/PillContainer";
import PreviewComponent from "./PreviewComponent";

export default function Project({
    chat, messages, previousMessage, currentPreset,
    configuration, operations, revisions, activeRevision
}) {

    let websocketChat = (
        <WebSocketChat
            chat={chat}
            messages={messages}
            previousMessage={previousMessage}
            currentPreset={currentPreset}
            configuration={configuration}
            operations={operations}
        />
    );

    let widget;

    if (revisions.length > 0) {
        let pills = [{
            key: 'Chat',
            label: 'Chat',
            content: websocketChat
        }, {
            key: "source_files",
            label: "Project files",
            content: (
                <div className="h-[80vh]">
                    <IDE chatId={chat.id} activeRevision={activeRevision} revisions={revisions} />
                </div>
        )}, {
            key: "preview",
            label: "Preview",
            content: (
                <div>
                    <PreviewComponent chatId={chat.id} />
                </div>
            )
        }];

        widget = <PillContainer pills={pills} />;
    } else {
        widget = websocketChat;
    }

    return (
        <div>{widget}</div>
    );
}