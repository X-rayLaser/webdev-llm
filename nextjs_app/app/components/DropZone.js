import React, { useState } from "react";

export default function DropZone({ children, onDrop }) {
    const [dragOver, setDragOver] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            onDrop(e.dataTransfer.files);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-4 rounded ${dragOver ? "border-blue-500 bg-blue-100" : "border-gray-300"
                }`}
        >
            {children}
        </div>
    );
}
