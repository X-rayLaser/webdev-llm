"use client"
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";


function ExpandableWell({ title, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-300 rounded-2xl shadow-sm overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-4 py-2 text-left text-gray-800
                    ${isOpen ? 'rounded-t-2xl' : 'rounded-2xl'} 
                    transition bg-gray-300 hover:bg-gray-400`}
            >
                <span className="font-bold text-lg">{title}</span>
                <FontAwesomeIcon
                    icon={isOpen ? faChevronDown : faChevronRight}
                    className="transition-transform"
                />
            </button>

            <div
                className={`transition-all duration-300 ease-in-out bg-white text-gray-700 ${isOpen
                        ? 'max-h-[1000px] opacity-100 border-t border-gray-400 px-4 py-4'
                        : 'max-h-0 opacity-0 px-4'
                    }`}
            >
                {children}
            </div>
        </div>
    );
}


export function CotPanel({ title="Thoughts", text }) {
    return (
        <ExpandableWell title={title}>{text}</ExpandableWell>
    );
}