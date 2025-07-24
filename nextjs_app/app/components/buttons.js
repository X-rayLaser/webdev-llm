"use client"
import React, { useState, useEffect } from "react";


export function OutlineButtonSmall({ className, children, ...rest }) {
  return (
      <button className="py-1 px-4 hover:bg-sky-800 hover:text-white hover:border-violet-400 border-2
                       border-sky-800 rounded-md text-sm font-semibold disabled:bg-gray-500 bg-inherit text-inherit"
              {...rest}>
          {children}
      </button>
  );
}


export function Button({ className="", children, ...otherProps }) {
  return (
    <button className="bg-blue-700 px-10 py-2 rounded-md text-white hover:bg-blue-900 disabled:bg-gray-500"
        {...otherProps}
    >
      {children}
    </button>
  );
}

export function GroupButton({ className="", children, ...otherProps }) {
  return (
    <button className="bg-blue-400 px-5 py-2 text-white hover:bg-blue-900 disabled:bg-gray-500"
        {...otherProps}
    >
      {children}
    </button>
  );
}

export function SubmitButton({ text="Submit", children, disabled=false, ...otherProps }) {
    return (
        <button className="bg-blue-700 px-10 py-2 rounded-md text-white hover:bg-blue-900 disabled:bg-gray-500"
            type="submit"
            disabled={disabled}
            {...otherProps}
        >
            {text}
            <span>{children}</span>
        </button>
    );
}

export function CancelButton({ children, text="Cancel", ...otherProps }) {
    return (
        <button className="bg-blue-200 px-10 py-2 rounded-md text-gray-700 hover:bg-blue-300 disabled:bg-gray-500"
            {...otherProps}
        >
            {text}
            <span>{children}</span>
        </button>
    );
}


export function ProminentButton({ className, children, ...rest }) {
    return (
        <button className="pl-16 pr-16 pt-4 pb-4 bg-violet-900 hover:bg-violet-950 text-white border-2
                         border-white rounded-md text-lg font-semibold"
                {...rest}>
            {children}
        </button>
    );
}


export function OutlineButton({ className, children, ...rest }) {
    return (
        <button className="px-2 py-2 hover:bg-sky-800 hover:text-white hover:border-violet-800 text-gray-800 border-2
                         border-sky-800 rounded-md text-lg font-semibold disabled:bg-gray-500"
                {...rest}>
            {children}
        </button>
    );
}


export function OutlineButtonFluid({ className, children, ...rest }) {
  return (
      <button className="py-2 w-full hover:bg-sky-800 hover:text-white hover:border-violet-800 text-gray-800 border-2
                       border-sky-800 rounded-md text-lg font-semibold disabled:bg-gray-500"
              {...rest}>
          {children}
      </button>
  );
}


export function FixedSizeOutlineButton({ className, children, width, ...rest }) {
  
  return (
    <div className="text-center" style={{ width: `${width}px`}}>
      <OutlineButtonFluid {...rest}>{children}</OutlineButtonFluid>
    </div>
  );
}


export function ButtonGroup({ children }) {
    return (
        <div className="[&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md *:border-cyan-950 *:border">
            {children}
        </div>
    );
}


export function DialogButton({ className, children, ...rest }) {
    return (
        <button className="pl-6 pr-6 pt-2 pb-2 bg-cyan-700 text-white hover:bg-cyan-900" {...rest}>
            {children}
        </button>
    );
}


export function ButtonDropdown({ actions, defaultAction = null }) {
  // Initialize selectedAction with defaultAction if provided
  const [selectedAction, setSelectedAction] = useState(defaultAction);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSelectedAction(defaultAction);
    setIsOpen(false);
  }, [actions, defaultAction]);

  return (
    <div className="relative inline-block">
      {/* Main Button */}
      <button
        className={`flex justify-between items-center px-4 py-2 bg-blue-500 text-white w-48
          ${isOpen ? "rounded-t" : "rounded"} transition-all`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedAction ? selectedAction.label : "Select Action"}
        <span className="ml-2">&#9662;</span> {/* Down Arrow */}
      </button>

      {/* Dropdown Buttons */}
      {isOpen && (
        <div className="absolute mt-0 bg-white shadow-lg w-48 rounded-b border border-t-0">
          {actions.map((action) => (
            <button
              key={action.name}
              className="w-full text-left px-4 py-2 hover:bg-gray-200"
              onClick={() => {
                setSelectedAction(action); // Set the selected action
                setIsOpen(false); // Close the dropdown
                action.onSelect(); // Trigger the action
              }}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export function DiscardButton({ className, text="Discard", children, ...props}) {
  return (
    <button
      className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:bg-gray-400"
      {...props}
    >
      {children}
    </button>
  );
}

export function CommitButton({ className, text="Commit", ...props}) {
  return (
    <button
      className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:bg-gray-400"
      {...props}
    >
      {text}
    </button>
  );
}