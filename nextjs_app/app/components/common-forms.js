"use client"

import React from 'react';


export function TextField({ id, label="", type="text", value, placeholder="", onChange }) {
    label = label || capitalize(id);

    placeholder = placeholder || `Fill in "${id}"`
    return (
        <div className="flex items-center">
            <label htmlFor={id} className='basis-28 shrink-0 grow-0 font-semibold'>{label}</label>
            <input className="border border-stone-400 ml-2 rounded-lg required:bg-red-500 p-2 grow min-w-0"
                type={type}
                id={id}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
            />
        </div>
    );
}

export function NumberField({ id, label="", min=0, max=1, step=0.1, value, placeholder="", onChange }) {
    label = label || capitalize(id);

    placeholder = placeholder || `Fill in "${id}"`
    return (
        <div className="flex items-center">
            <label htmlFor={id} className='basis-28 shrink-0 grow-0 font-semibold'>{label}</label>
            <input className="border border-stone-400 ml-2 rounded-lg required:bg-red-500 p-2 grow min-w-0"
                type="number"
                id={id}
                min={min}
                max={max}
                step={step}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
            />
        </div>
    );
}


export function TextArea({ id, label, value, placeholder="", onChange }) {
    label = label || capitalize(id);

    placeholder = placeholder || `Please, enter value for the "${id}"`
    return (
        <div className="mb-5">
            <label htmlFor={id} className="font-semibold">{label}</label>
            <textarea className="block w-full border border-stone-400 rounded-lg p-2"
                id={id}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                rows={7}
            />
        </div>
    );
}

export function Form({ children }) {
    return (
        <form className="border-2 rounded-lg border-cyan-800 p-6 text-gray-800 max-w-md bg-slate-200">
            {children}
        </form>
    );
}

export function SubmitButton() {
    return (
        <button type="submit" className="bg-blue-700 px-10 py-2 rounded-md text-white hover:bg-blue-900">
            Submit
        </button>
    );
}

export const jsonPlaceholder = `{
    "param1": "value1",
    "param2": "value2"
}`;

function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1).toLowerCase();
}
