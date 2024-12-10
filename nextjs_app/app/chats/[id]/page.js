import PageWithSidePanel from "../PageWithSidePanel";
import MessageCard from "./MessageCard";
import NewMessageForm from "./NewMessageForm";
import { RunningOperationsList } from "./running_ops";

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
    const data = await response.json();

    if (!data.messages || data.messages.length === 0) {
        return (
            <div>Chat is empty. No messages here yet</div>
        );
    }

    const configurationResponse = await fetch(data.configuration);
    const configuration = await configurationResponse.json();
    const presetsResponse = await fetch(`http://django:8000/api/presets/`);
    const presets = await presetsResponse.json();
    const currentPreset = presets.filter(p => p.name === configuration.preset)[0];


    const openningMessageResponse = await fetch(data.messages[0]);
    const openningMessage = await openningMessageResponse.json();
    const thread = getThread(openningMessage);

    const previousMessage = thread[thread.length - 1];

    const messages = removeEmptyMessages(thread).map(
        (msg, idx) => <MessageCard key={idx} message={msg} />
    );

    const opsResponse = await fetch(`http://django:8000/api/chats/${id}/generations/?status=in_progress`);
    const operations = await opsResponse.json();

    return (
        <PageWithSidePanel searchParams={searchParams}>
            <div>{data.name.substring(0, 100)}...</div>
            <h2>Messages</h2>
            <div className="flex flex-col gap-4 justify-around">{messages}</div>
            
            <div className="mt-4">
                <NewMessageForm chat={chat} previousMessage={previousMessage} preset={currentPreset} />
            </div>
            <RunningOperationsList operations={operations}/>
        </PageWithSidePanel>
    );
}