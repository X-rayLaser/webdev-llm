import MessageCard from "./MessageCard";
import WebSocketChat from "./WebSocketChat";

function getThread(rootMsg) {
    const thread = [rootMsg];
    let current = rootMsg;

    while (current.replies.length > 0) {
        let index = current.child_index;
        let reply = current.replies[index] || current.replies[0];
        reply.branches = current.replies.length;
        reply.branchIndex = index;
        thread.push(reply);
        current = reply;
    }

    return thread;
}

function removeEmptyMessages(thread) {
    const isEmpty = ({ content_ro }) => (
        content_ro.modality_type === "mixture" && content_ro.mixture.length === 0
    );
    return thread.filter(msg => !isEmpty(msg));
}


export default async function Page(props) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const id = params.id;

    const response = await fetch(`http://django:8000/api/chats/${id}/`);
    const chat = await response.json();

    if (!chat.messages || chat.messages.length === 0) {
        return (
            <div>Chat is empty. No messages here yet</div>
        );
    }

    const configurationResponse = await fetch(chat.configuration);
    const configuration = await configurationResponse.json();
    const presetsResponse = await fetch(`http://django:8000/api/presets/`);
    const presets = await presetsResponse.json();
    const currentPreset = presets.filter(p => p.name === configuration.preset)[0];


    const openningMessageResponse = await fetch(chat.messages[0]);
    const openningMessage = await openningMessageResponse.json();
    const thread = getThread(openningMessage);

    const previousMessage = thread[thread.length - 1];

    const generationConfig = {
        model_name: configuration.llm_model || "",
        ...currentPreset
    };

    const messages = removeEmptyMessages(thread).map(
        (msg, idx) => <MessageCard key={idx} message={msg} generationConfig={generationConfig} />
    );

    const opsResponse = await fetch(`http://django:8000/api/chats/${id}/generations/?status=in_progress`);
    const operations = await opsResponse.json();

    return (
        <div>
            <WebSocketChat
                chat={chat}
                messages={messages}
                previousMessage={previousMessage}
                currentPreset={currentPreset}
                configuration={configuration}
                operations={operations}
            />
        </div>
    );
}

export const dynamic = 'force-dynamic';