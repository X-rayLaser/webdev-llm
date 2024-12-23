import ChatSidePanel from "./ChatSidePanel";
import ChatSidePanelToggle from "./ChatSidePanelToggle";

export default async function PageWithSidePanel({ searchParams, children }) {
    let sidePanel = <ChatSidePanel queryParams={searchParams} />;
    let togglePanel = <ChatSidePanelToggle chatSidePanel={sidePanel} />;

    return (
        <div>
            <div className="md:hidden">
                <div className="w-80">
                    <div className="fixed max-w-[inherit] h-dvh">
                        {togglePanel}
                    </div>
                            
                </div>

                <div className="ml-8">
                    {children}
                </div>
            </div>
            <div className="hidden md:block">
                <div className="flex items-start">
                    <div className="shrink-0 grow-0 w-10/12 sm:w-80 max-w-[800px]">
                        <div className="fixed w-[inherit] max-w-[inherit]">
                            {togglePanel}
                        </div>
                    </div>

                    <div className="grow p-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}