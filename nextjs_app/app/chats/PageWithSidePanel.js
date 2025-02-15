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

    return (
        <div>
            <div className="md:hidden">
                <div className="w-80">
                    <div className="fixed max-w-[inherit] h-dvh z-10">
                        {togglePanel}
                    </div>
                            
                </div>

                <div className="px-2">
                    {children}
                </div>
            </div>
            <div className="hidden md:block">
                <div className="flex items-start">
                    <div className="shrink-0 grow-0 w-10/12 sm:w-80 max-w-[800px]">
                        <div className="fixed w-[inherit] max-w-[inherit] z-10">
                            {togglePanel}
                        </div>
                    </div>

                    <div className="grow px-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}