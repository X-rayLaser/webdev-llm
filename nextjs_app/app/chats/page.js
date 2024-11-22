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
    const configsResponse = await fetch("http://django:8000/api/configs/");
    const configs = await configsResponse.json();
    
    let items = [1,2,3,4].map(() => (
        <div className="mb-4">
            <Card
                header={exampleChat.summary}
                imageUrl={exampleData.imageUrl}
                text={exampleChat.lastMessage}
                buttonLabel={exampleData.buttonLabel}
                createdAt={exampleData.createdAt}
            />
        </div>
    ));
    return (
        <div className="p-5 w-1/2">
            <NewChatForm configs={configs} />
            <div>{items}</div>
    </div>
    );
}