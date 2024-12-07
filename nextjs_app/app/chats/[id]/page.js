import PageWithSidePanel from "../PageWithSidePanel";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";
import { createMultimediaMessage } from "@/app/actions";
import MessageCard from "./MessageCard";

function getThread(rootMsg) {
    const thread = [rootMsg];
    let current = rootMsg;

    while (current.replies.length > 0) {
        let index = current.child_index;
        let reply = current.replies[index];
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

    const openningMessageResponse = await fetch(data.messages[0]);
    const openningMessage = await openningMessageResponse.json();
    const thread = getThread(openningMessage);

    const previousMessage = thread[thread.length - 1];

    const messages = removeEmptyMessages(thread).map(
        (msg, idx) => <MessageCard key={idx} message={msg} />
    );

    const role = previousMessage.role === "assistant" ? "user" : "assistant";

    const formAction = createMultimediaMessage.bind(null, role, previousMessage.id);

    return (
        <PageWithSidePanel searchParams={searchParams}>
            <div>{data.name.substring(0, 100)}...</div>
            <h2>Messages</h2>
            <div className="flex flex-col gap-4 justify-around">{messages}</div>
            <div className="mt-4">
                <AdvancedMessageConstructor
                    formAction={formAction}
                />
            </div>
        </PageWithSidePanel>
    );
}