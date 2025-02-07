import React, { useState } from 'react';

const PillContainer = ({ pills }) => {
    const [activePill, setActivePill] = useState(pills[0].key);

    const renderActiveContent = () => {
        const activeContent = pills.find(pill => pill.key === activePill);
        return activeContent ? activeContent.content : null;
    };

    return (
        <div className="flex flex-col">
            <div className="flex gap-0 fixed">
                {pills.map(pill => (
                    <Pill key={pill.key} pill={pill} activePill={activePill} setActivePill={setActivePill} />
                ))}
            </div>
            <div className="pill-content mt-12">
                {renderActiveContent()}
            </div>
        </div>
    );
};

function Pill({ pill, activePill, setActivePill }) {
    const activeClasses = 'bg-sky-900 text-blue-200';
    const inactiveClasses = 'text-gray-600 bg-gray-50 hover:bg-sky-100';
    const conditionalClasses = activePill === pill.key ? activeClasses : inactiveClasses;
    return (
        <button
            className={`px-4 py-2 text-lg font-semibold focus:outline-none transition-colors duration-200 ${conditionalClasses}`}
            onClick={() => setActivePill(pill.key)}
        >
            {pill.label}
        </button>
    );
}


export default PillContainer;
