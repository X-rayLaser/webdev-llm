"use client"
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAnglesLeft, faAnglesRight } from '@fortawesome/free-solid-svg-icons'


export default function ChatSidePanelToggle({ chatSidePanel }) {
    const [isPanelVisible, setIsPanelVisible] = useState(true);

    const togglePanelVisibility = () => {
        setIsPanelVisible(!isPanelVisible);
    };

    return (
        <div className={`${isPanelVisible ? 'w-10/12 sm:w-80 md:max-w-80 shrink-0 grow-0' : 'w-8'}`}>
            <div className="fixed w-[inherit] max-w-[inherit] h-dvh z-10">
                <div className="relative h-full">
                    {isPanelVisible ? (
                        <div>
                            <div className="bg-slate-200 flex justify-between">
                                <div></div>
                                <button
                                    onClick={togglePanelVisibility}
                                    className="p-2 bg-blue-400 text-white hover:bg-gray-500 rounded-l-lg"
                                >
                                    <FontAwesomeIcon icon={faAnglesLeft} size="lg" />
                                </button>
                            </div>
                            {chatSidePanel}
                        </div>
                    ) : (
                        <div className="h-dvh w-0 bg-slate-200">
                            <div className="h-full"></div>
                            <button
                                onClick={togglePanelVisibility}
                                className="absolute top-0 z-100 p-2 bg-blue-400 opacity-30 text-white rounded-r-lg hover:bg-gray-500"
                                title="Expand Panel"
                            >
                                <FontAwesomeIcon icon={faAnglesRight} size="lg" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

