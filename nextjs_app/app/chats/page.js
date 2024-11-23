import { Card } from "@/app/chats/ChatItem";
import NewChatForm from "./NewChatForm";


const exampleChat = {
    systemMessage: "Please ensure that all responses are concise, informative, and polite. Additionally, maintain a tone that is approachable and friendly. Avoid using overly technical jargon unless specifically requested by the user. If a question is ambiguous or lacks sufficient details, ask clarifying questions before providing an answer.",
    prompt: "Can you explain the theory of relativity in simple terms for someone who has no background in physics, but is curious about how it applies to the universe and our understanding of space-time?",
    summary: "The user asked for a layman's explanation of Einstein's theory of relativity and its significance in understanding the universe.",
    lastMessage: "Certainly! The theory of relativity, proposed by Albert Einstein, fundamentally changed how we understand space, time, and gravity. The 'special relativity' part explains that time and space are interconnected, forming a single continuum called spacetime. Objects moving close to the speed of light experience time and space differently than stationary ones. The 'general relativity' part explains gravity not as a force but as a curvature in spacetime caused by massive objects. This idea helps explain phenomena like black holes, gravitational waves, and the expansion of the universe.",
    imageUrl: "/app/test-image.jpeg",
  };


const exampleData = {
    header: "Introduction to React",
    imageUrl: "/app/test-image.jpeg",
    text: "React is a popular JavaScript library for building user interfaces. Learn how to create components, manage state, and handle events efficiently with React.",
    buttonLabel: "Resume chat",
    createdAt: "2024-11-12T09:30:00",
};

export default async function Page() {
    //todo: error handling
    const configsResponse = await fetch("http://django:8000/api/configs/");
    const configs = await configsResponse.json();

    const chatsResponse = await fetch("http://django:8000/api/chats/");
    const chats = await chatsResponse.json();

    const topChats = chats.slice(2);

    async function fetchMessage(url) {
        const response = await fetch(url);
        return await response.json();
    }

    async function getPrompt(chat) {
        return await fetchMessage(chat.messages[0]);
    }

    async function getLastMessage(chat) {
        const lastUrl = chat.messages[chat.messages.length - 1];
        return await fetchMessage(lastUrl);
    }

    async function getFirstAndLastMessages(chat) {
        const [prompt, lastMessage] = await Promise.all([getPrompt(chat), getLastMessage(chat)]);
        return { prompt, lastMessage };
    }

    const promises = topChats.map(chat => 
        new Promise(
            resolve => getFirstAndLastMessages(chat).then(res => {
                resolve({ chat, prompt: res.prompt, lastMessage: res.lastMessage });
            })
        )
    );

    const chatsWithMessages = await Promise.all(promises);
    console.log("chatsWithMessages", chatsWithMessages)
    
    let items = chatsWithMessages.map((obj, idx) => (
        <div key={idx} className="mb-4">
            <Card
                header={obj.chat.name}
                imageUrl="/app/test-image.jpeg"
                prompt={obj.lastMessage.content_ro.text}
                lastMessage={obj.lastMessage.content_ro.text}
                buttonLabel={exampleData.buttonLabel}
                createdAt={exampleData.createdAt}
            />
        </div>
    ));
    return (
        <div className="p-5 w-1/2">
            <NewChatForm configs={configs} />


            <h4 className="text-2xl my-4 text-center font-bold">Recent chats</h4>
            <div>{items}</div>
    </div>
    );
}