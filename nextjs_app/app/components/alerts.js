"use client"

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'


export function Alert({ text, level="info", size="lg" }) {
    let bgColor;
    let borderColor;
    let padding;

    switch (level) {
        case "danger":
            bgColor = "red";
            borderColor = "orange";
            break;
        case "info":
            bgColor = "cyan";
            borderColor = "blue";
            break;
        default:
            bgColor = "coral";
            borderColor = "cyan";
    }

    switch (size) {
        case "lg":
            padding = "p-5";
            break;
        case "md":
            padding = "p-3";
        case "sm":
            padding = "p-2";
        case "xs":
            padding = "p-0";
        default:
            padding = "p-1";
    }

    const bgClass = `bg-${bgColor}-300`;
    const borderColorClass = `border-${bgColor}-600`;
    const textColor = `text-${bgColor}-800`;

    return (
        <div className={`${bgClass} rounded-sm border-2 ${padding} ${borderColorClass} text-center font-semibold ${textColor} shadow-lg`}>
            <span>
                <FontAwesomeIcon icon={faTriangleExclamation} />
            </span>
            <span className="ml-2">{text}</span>
        </div>
    );
}