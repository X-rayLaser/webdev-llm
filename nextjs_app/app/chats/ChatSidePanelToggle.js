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
        <div className="relative h-full">
            {isPanelVisible ? (
                <div>
                    <div className="bg-slate-200 flex justify-between">
                        <div></div>
                        <button
                            onClick={togglePanelVisibility}
                            className="py-1 w-12 bg-blue-400 text-white hover:bg-gray-500 rounded-l-lg"
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
                        className="absolute top-0 z-100 w-12 py-1 bg-blue-400 text-white rounded-r-lg hover:bg-gray-500"
                        title="Expand Panel"
                    >
                        <FontAwesomeIcon icon={faAnglesRight} size="lg" />
                    </button>
                </div>
            )}
        </div>
    );
}

