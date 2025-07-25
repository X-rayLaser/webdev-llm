"use client"
import React, { useState, useEffect, useRef } from "react";
import { Alert } from './alerts';
import { capitalize } from "../utils";
import { Switch } from "./buttons";

function FlexInputField(props) {
    let { extraInputClasses, ...other} = props;

    return (
        <input className={`ml-2 rounded-lg p-2 grow min-w-0 ${extraInputClasses}`}
            {...other}
        />
    );
}

function FlexSelectField({ extraInputClasses, initialText="Select an item", options, ...other }) {
    const optionList = options.map((opt, idx) =>  
        <option key={idx} value={opt.value}>{opt.label}</option>
    );
    return (
        <select className={`ml-2 rounded-lg p-2 grow min-w-0 ${extraInputClasses}`}
                type="select" {...other}>
            <option value="">{initialText}</option>
            {optionList}
        </select>
    );
}


function TextAreaField({ extraInputClasses, value="", ...other }) {
    if (typeof value === "object") {
        value = JSON.stringify(value, null, 2);
    }
    return (
        <textarea className={`block w-full rounded-lg p-2 ${extraInputClasses}`}
            rows={7}
            value={value}
            {...other}
        />
    )
}


function getTextWidth(text, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    context.font = font || getComputedStyle(document.body).font;
  
    return context.measureText(text).width;
}


export function AutoExpandingTextAreaField({ extraInputClasses = "", value = "", onChange, ...otherProps }) {
    if (typeof value === "object") {
        value = JSON.stringify(value, null, 2);
    }
    const [rows, setRows] = useState(1);
    const [textAreaEffectiveWidth, setTextAreaEffectiveWidth] = useState(0);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            const textareaWidth = textarea.offsetWidth;

            const style = getComputedStyle(textarea);
            const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);

            const effectiveWidth = textareaWidth - padding - border;
            setTextAreaEffectiveWidth(effectiveWidth)
        }
    }, [textareaRef]);

    const handleTextChange = (e) => {
        const newText = e.target.value;
        onChange(e);

        // Calculate rows needed based on text and max characters per line
        const lineCount = newText.split("\n").length;
        const textWithoutBreaks = newText.replace(/\n/g, "");
        const font = getComputedStyle(textareaRef.current).font;
        const textWidth = getTextWidth(textWithoutBreaks, font);
        const extraRows = Math.ceil(textWidth / textAreaEffectiveWidth)
        //todo: add optionall word-wrap:break-word; word-break:break-all; to allow breaking word when wrapping text

        setRows(Math.max(lineCount + extraRows, 1));
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            rows={rows}
            className={`block w-full rounded-lg p-2 ${extraInputClasses}`}
            {...otherProps}
        />
    );
}


function FormFieldWithErrors({ errors=[], children } ) {
    const errorElements = errors.map((error, idx) => 
        <div key={idx} className="mt-2">
            <Alert text={error} level="danger" size="xs" />
        </div>
    );

    return (
        <div>
            <div>{children}</div>
            {errorElements.length > 0 && (
                <div>{errorElements}</div>
            )}
        </div>
    );
}


function InlineFormField({ label, field, errors=[] }) {
    const extraLabelClasses = errors.length > 0 ? "text-red-600" : "";
    return (
        <FormFieldWithErrors errors={errors}>
            <div className="flex items-center">
                <div className={`basis-28 shrink-0 grow-0 font-semibold ${extraLabelClasses}`}>
                    {label}
                </div>
                {field}
            </div>
        </FormFieldWithErrors>
    );
}


function BlockedFormField({ label, field, errors=[] } ) {
    const extraLabelClasses = errors.length > 0 ? "text-red-600" : ""
    return (
        <FormFieldWithErrors errors={errors}>
            <div>
                <div className={`font-semibold ${extraLabelClasses}`}>
                    {label}
                </div>
                {field}
            </div>
        </FormFieldWithErrors>
    );
}

function LabelessFormField({ field, errors=[] }) {
    return (
        <FormFieldWithErrors errors={errors}>{field}</FormFieldWithErrors>
    );
}


function WrappedField({ name, id="", label="", placeholder="", errors=[], FieldComponent, FieldContainer, ...rest }) {
    label = label || capitalize(name);
    id = id || `${name}_id`;
    placeholder = placeholder || `Fill in "${name}"`;

    const extraInputClasses = errors.length > 0 ? "border-2 border-red-600" : "border border-stone-400";

    let labelField = <label htmlFor={id}>{label}</label>;

    let inputProps = {
        id, label, name, placeholder, extraInputClasses, ...rest
    };
    let inputField = (
        <FieldComponent {...inputProps} />
    );
    return (
        <FieldContainer label={labelField} field={inputField} errors={errors} />
    );
}


export function ImageField({ name, id = "", label = "", onChange, errors }) {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImage(file);
        }
    };

    const handleImage = (file) => {
        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result);
            if (onChange) onChange(file); // Pass file to the parent component
        };
        reader.readAsDataURL(file);
    };

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
            fileInputRef.current.files = e.dataTransfer.files;
            handleImage(file);
        }
    };

    return (
        <div className="flex flex-col space-y-4">
            {/* Drop Area */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed p-4 rounded ${dragOver ? "border-blue-500 bg-blue-100" : "border-gray-300"
                    }`}
            >
                {preview ? (
                    <div className="flex flex-col items-center space-y-2">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-48 object-cover rounded"
                        />
                        <p className="text-sm text-gray-600">Drag a new image to replace</p>
                    </div>
                ) : (
                    <div className="text-center text-gray-500">
                        <p>Drag and drop an image here</p>
                        <p>or</p>
                        <p>Click to select an image</p>
                    </div>
                )}
            </div>

            {/* File Input */}
            <input
                ref={fileInputRef}
                name={name}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file:hidden cursor-pointer"
            />
        </div>
    );
};


export function TextField(props) {
    return <WrappedField type="text" FieldComponent={FlexInputField} FieldContainer={InlineFormField} {...props} />
}


export function NumberField(props) {
    let { min=0, max=1, step=0.1, ...rest } = {...props};
    let allProps = { min, max, step, ...rest};
    return <WrappedField type="number" FieldComponent={FlexInputField} FieldContainer={InlineFormField} {...allProps} />
}


export function FileField(props) {
    return <WrappedField type="file" FieldComponent={FlexInputField} FieldContainer={InlineFormField} {...props} />
}


export function TextArea(props) {
    return <WrappedField FieldComponent={TextAreaField} FieldContainer={BlockedFormField} {...props} />
}

export function AutoExpandingTextArea(props) {
    return <WrappedField FieldComponent={AutoExpandingTextAreaField} FieldContainer={LabelessFormField} {...props} />
}

export function SelectField(props) {
    return <WrappedField FieldComponent={FlexSelectField} FieldContainer={InlineFormField} {...props} />
}

function CheckBox({ extraInputClasses, checked, ...props }) {
    const className = `${extraInputClasses}`;
    return <input type="checkbox" className={className} checked={checked} {...props} />
}

function SwitchCheck({ extraInputClasses, checked, onChange, ...props }) {
    const className = `${extraInputClasses}`;
    const inputRef = useRef(null);
    
    const handleCheck = () => {
        if (inputRef.current) {
            const target = inputRef.current;
            target.checked = !checked;
            onChange({ target });
        }
    };
    return (
        <div className={className}>
            <input ref={inputRef} type="checkbox" onChange={onChange} checked={checked} {...props} className="hidden" />
            <Switch isOn={checked} onClick={() => handleCheck()} />
        </div>
    );
}


function CheckBoxFieldRow({ label, field, errors=[] }) {
    const extraLabelClasses = errors.length > 0 ? "text-red-600" : "";
    return (
        <FormFieldWithErrors errors={errors}>
            <div>

                <span>{field}</span>
                <span className={`ml-2 font-semibold ${extraLabelClasses}`}>
                    {label}
                </span>
            </div>
        </FormFieldWithErrors>
    );
}

export function CheckboxField(props) {
    return <WrappedField FieldComponent={CheckBox} FieldContainer={CheckBoxFieldRow} {...props} />
}


export function SwitchField({ label, ...props }) {
    return (
        <div className="flex items-center">
            <div className="basis-28 shrink-0 grow-0 font-semibold">{label}</div>
            <div className="ml-2">
                <SwitchCheck {...props} />
            </div>
        </div>
    );
}


function dummyOnSubmit(e) {

}


export function Form({ action, variant="default", onSubmit=dummyOnSubmit, children }) {
    let borderColorClass;
    let borderWidthClass;
    let padding;

    switch (variant) {
        case "danger":
            borderColorClass = "border-red-600";
            borderWidthClass = "border-4";
            padding = "p-6";
            break;
        case "compact":
            borderWidthClass = "border-0";
            padding = "p-0";
            break;
        default:
            borderColorClass = "border-cyan-600";
            borderWidthClass = "border-2";
            padding = "p-6";
    }
    
    return (
        <form className={`${borderWidthClass} rounded-lg ${borderColorClass} ${padding} text-gray-800 max-w-md bg-slate-200`}
            action={action}
            onSubmit={onSubmit}>
            {children}
        </form>
    );
}


export const jsonPlaceholder = `{
    "param1": "value1",
    "param2": "value2"
}`;
