import PageWithSidePanel from "../PageWithSidePanel";
import AdvancedMessageConstructor, { ModalityViewer } from "../AdvancedMessageConstructor";


function getThread(rootMsg) {
    const thread = [rootMsg];
    let current = rootMsg;

    while (current.replies.length > 0) {
        let reply = current.replies[0];
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

function decorateWithSources(modalityObject, sourceFiles) {
    if (modalityObject.modality_type === "code") {
        const matches = sourceFiles.filter(f => f.file_path === modalityObject.file_path);
        if (matches.length > 0) {
            modalityObject.code = matches[0].content;
        }
    } else if (modalityObject.modality_type === "mixture") {
        modalityObject.mixture.forEach(mod => {
            decorateWithSources(mod, sourceFiles);
        });
    }
}


function MessageCard({ message }) {
    const modality = message.content_ro;
    const sources = (
        message?.active_revision?.src_tree || 
        (message.revisions.length === 1 && message.revisions[0]?.src_tree) ||
        []
    );


    console.log("MessageCard",  message);
    decorateWithSources(modality, sources);
    return (
        <div>
            <div className="p-4 border rounded-lg shadow-lg bg-sky-700">
                <ModalityViewer modalityObject={modality} />
            </div>
        </div>
    );
}


export default async function Page(props) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const id = params.id;

    const response = await fetch(`http://django:8000/api/chats/${id}/`);
    const data = await response.json();
    console.log("chats data:", response.status, data)

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

    return (
        <PageWithSidePanel searchParams={searchParams}>
            <div>{data.name.substring(0, 100)}...</div>
            <h2>Messages</h2>
            <div className="flex flex-col gap-4 justify-around">{messages}</div>
            <div className="mt-4">
                <AdvancedMessageConstructor previousMessage={previousMessage} />
            </div>
        </PageWithSidePanel>
    );
}