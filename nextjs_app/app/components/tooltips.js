import React, { useState } from "react";

export function Tooltip({ content, children }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-pointer"
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-700 text-white rounded shadow-lg text-sm"
          style={{ whiteSpace: "nowrap" }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
