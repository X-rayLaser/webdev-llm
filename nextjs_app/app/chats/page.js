import { Card } from "@/app/chats/ChatItem";
import NewChatForm from "./NewChatForm";
import { fetchChats } from "../utils";

export default async function Page(props) {
    //todo: error handling
    const configsResponse = await fetch("http://django:8000/api/configs/");
    const configs = await configsResponse.json();

    const [ chats, ...rest ] = await fetchChats("http://django:8000/api/chats/");
    const topChats = chats.slice(0);

    async function fetchMessage(url) {
        //use lite version of API endpoint to fetch the message
        url = url + "?lite=true"
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

    const fallBackImage = "/app/test-image.jpeg";
    
    let items = chatsWithMessages.map((obj, idx) => (
        <div key={idx} className="mb-4">
            <Card
                header={obj.chat.name}
                imageUrl={(obj.chat.image && obj.chat.image.replace("django:8000", "localhost")) || fallBackImage}
                prompt={obj.prompt.content_ro.text}
                lastMessage={obj.lastMessage.content_ro.text}
                buttonLabel="Resume chat"
                buttonHref={`/chats/${obj.chat.id}`}
                createdAt={obj.created}
            />
        </div>
    ));
    return (
        <div>
            <div className="md:hidden">
                <NewChatForm configs={configs} />

                <div className="mt-16">
                    <h4 className="text-2xl mb-4 text-center font-bold">Recent chats</h4>
                    <div>{items}</div>
                </div>
            </div>
            <div className="hidden md:block">
                <div className="grow px-4">
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
        </div>
    );
}
