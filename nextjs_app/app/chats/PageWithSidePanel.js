import ChatSidePanel from "./ChatSidePanel";


export default async function PageWithSidePanel({ searchParams, children }) {
    let chatsPanel = <ChatSidePanel queryParams={searchParams} />;
    return (
        <div>
            <div className="md:hidden">
                <div className="w-80">
                    <div className="fixed w-[inherit] max-w-[inherit] h-dvh">
                        {chatsPanel}
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
                            {chatsPanel}
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