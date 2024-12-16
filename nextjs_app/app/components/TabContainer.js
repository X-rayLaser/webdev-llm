import React, { useState } from 'react';

const TabContainer = ({ tabs }) => {
    const [activeTab, setActiveTab] = useState(tabs[0].key);

    const renderActiveContent = () => {
        const activeTabContent = tabs.find(tab => tab.key === activeTab);
        return activeTabContent ? activeTabContent.content : null;
    };

    return (
        <div className="flex flex-col border border-gray-300 rounded shadow-md">
            <div className="flex border-b border-gray-300 bg-gray-100">
                {tabs.map(tab => (
                    <Tab key={tab.key} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
                ))}
            </div>
            <div className="tab-content p-4">
                {renderActiveContent()}
            </div>
        </div>
    );
};

function Tab({ tab, activeTab, setActiveTab }) {
    const activeClasses = 'bg-white text-blue-500 border-b-2 border-blue-500';
    const inactiveClasses = 'text-gray-500 hover:text-blue-500';
    const conditionalClasses = activeTab === tab.key ? activeClasses : inactiveClasses;
    return (
        <button
            className={`px-4 py-2 text-sm font-medium focus:outline-none transition-colors duration-200 ${conditionalClasses}`}
            onClick={() => setActiveTab(tab.key)}
        >
            {tab.label}
        </button>
    );
}


export default TabContainer;
