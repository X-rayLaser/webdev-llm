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
                    transition bg-gray-400 hover:bg-gray-500`}
            >
                <span className="font-bold text-lg">{title}</span>
                <FontAwesomeIcon
                    icon={isOpen ? faChevronDown : faChevronRight}
                    className="transition-transform"
                />
            </button>

            <div
                className={`transition-all duration-300 ease-in-out bg-slate-300 text-gray-900 text-justify text-lg tracking-wide font-mono ${isOpen
                        ? 'max-h-[4000px] opacity-100 px-4 py-4'
                        : 'max-h-0 opacity-0 px-4'
                    }`}
            >
                {children}
            </div>
        </div>
    );
}


export function CotPanel({ title="Thoughts", text }) {
    if (text) {
        text = text.split('\n\n').map((text, idx) => <p key={idx}>{text}</p>);
    }
    return (
        <ExpandableWell title={title}>
            <div className="flex flex-col gap-4">{text}</div>
        </ExpandableWell>
    );
}