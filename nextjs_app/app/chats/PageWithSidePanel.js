import { Suspense } from "react";
import ChatSidePanel from "./ChatSidePanel";
import ChatSidePanelToggle from "./ChatSidePanelToggle";

export default async function PageWithSidePanel({ children }) {
    let sidePanel = (
        <Suspense>
            <ChatSidePanel />
        </Suspense>
    );
    let togglePanel = <ChatSidePanelToggle chatSidePanel={sidePanel} />;

    //todo: prevent rendering children twice (this causes issues with doubly calling useEffect and issues with duplicating audio stream)
    return (
        <div className="md:flex md:items-start">
            <div className="w-10/12 sm:w-80 md:max-w-80 shrink-0 grow-0">
                <div className="fixed w-[inherit] max-w-[inherit] h-dvh z-10">
                    {togglePanel}
                </div>
            </div>

            <div className="px-2 md:grow md:px-4">
                {children}
            </div>
        </div>
    );
}