"use client"
import React, { useState, useRef, useEffect } from "react";

export default function Expandable({ collapsedHeight=0, children }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isExpandable, setIsExpandable] = useState(false);
    const contentRef = useRef(null);
  
    const toggleExpand = () => {
      setIsExpanded(!isExpanded);
    };
  
    useEffect(() => {
      // Check if content height exceeds 300px when the component mounts
      if (contentRef.current && contentRef.current.scrollHeight > collapsedHeight) {
        setIsExpandable(true);
      }
    }, []);
  
    return (
      <div className="overflow-hidden">
        {/* Collapsible Content */}
        <div
          ref={contentRef}
          style={{
            maxHeight: isExpanded ? contentRef.current.scrollHeight : collapsedHeight,
            transition: 'max-height 0.3s ease',
          }}
          className="overflow-hidden"
        >
          <div>
            {children}
          </div>
        </div>
  
        {isExpandable && (
          <div className="flex justify-left items-start mt-2">
            <button
              onClick={toggleExpand}
              className="text-blue-600 hover:underline"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        )}
        {!isExpandable && <div className="mb-2"><button className="invisible"></button></div>}
      </div>
    );
};