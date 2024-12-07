import { Card } from "@/app/chats/ChatItem";
import NewChatForm from "./NewChatForm";
import ChatSidePanel from "./ChatSidePanel";
import { fetchChats } from "../utils";
import PageWithSidePanel from "./PageWithSidePanel";

const exampleData = {
    header: "Introduction to React",
    imageUrl: "/app/test-image.jpeg",
    text: "React is a popular JavaScript library for building user interfaces. Learn how to create components, manage state, and handle events efficiently with React.",
    buttonLabel: "Resume chat",
    createdAt: "2024-11-12T09:30:00",
};

export default async function Page(props) {
    const query = await props.searchParams;

    //todo: error handling
    const configsResponse = await fetch("http://django:8000/api/configs/");
    const configs = await configsResponse.json();

    const [ chats, ...rest ] = await fetchChats("http://django:8000/api/chats/");
    const topChats = chats.slice(0);

    async function fetchMessage(url) {
        const response = await fetch(url);
        return await response.json();
    }

    async function getPrompt(chat) {
        if (chat.messages.length === 0) {
            throw "Unexpected error - empty chat";
        }
        return chat.messages ? await fetchMessage(chat.messages[0]) : "";
    }

    async function getLastMessage(chat) {
        if (chat.messages.length === 0) {
            throw "Unexpected error - empty chat";
        }
        const lastUrl = chat.messages[chat.messages.length - 1];
        return lastUrl ? await fetchMessage(lastUrl) : "";
    }

    async function getFirstAndLastMessages(chat) {
        const [prompt, lastMessage] = await Promise.all([getPrompt(chat), getLastMessage(chat)]);
        return { prompt, lastMessage };
    }

    const promises = topChats.map(chat => 
        new Promise(
            (resolve, reject) => getFirstAndLastMessages(chat).then(res => {
                resolve({ chat, prompt: res.prompt, lastMessage: res.lastMessage });
            }).catch(reject)
        )
    );
    
    const chatsWithMessages = [];
    
    const results = await Promise.allSettled(promises);
    results.forEach(result => {
        if (result.status === "fulfilled") {
            chatsWithMessages.push(result.value);
        } else {
            console.error("Promise rejected. Reason: ", result.reason);
        }
    });
    
    let items = chatsWithMessages.map((obj, idx) => (
        <div key={idx} className="mb-4">
            <Card
                header={obj.chat.name}
                imageUrl="/app/test-image.jpeg"
                prompt={obj.prompt.content_ro.text}
                lastMessage={obj.lastMessage.content_ro.text}
                buttonLabel={exampleData.buttonLabel}
                createdAt={exampleData.createdAt}
            />
        </div>
    ));

    return (
        <PageWithSidePanel searchParams={query}>
            <div className="md:hidden">
                <NewChatForm configs={configs} />

                <div className="mt-16">
                    <h4 className="text-2xl mb-4 text-center font-bold">Recent chats</h4>
                    <div>{items}</div>
                </div>
            </div>
            <div className="hidden md:block">
                <div className="grow p-4">
                    <div className="w-full lg:w-3/4 xl:w-1/2 mx-auto p-4 border border-blue-800 rounded-lg shadow-lg">
                        <h2 className="text-center font-bold text-2xl mb-2">Start new chat</h2>
                        <NewChatForm configs={configs} />
                    </div>

                    <div className="mt-16">
                        <h2 className="text-2xl mb-4 text-center font-bold">Recent chats</h2>
                        <div>{items}</div>
                    </div>
                </div>
            </div>
        </PageWithSidePanel>
    )
}