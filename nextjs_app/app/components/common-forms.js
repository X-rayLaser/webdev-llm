"use client"
import React, { useState, useEffect, useRef } from "react";
import { Alert } from './alerts';


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
    console.log("extraInputClasses", extraInputClasses)
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

export function TextField(props) {
    return <WrappedField type="text" FieldComponent={FlexInputField} FieldContainer={InlineFormField} {...props} />
}


export function NumberField(props) {
    let { min=0, max=1, step=0.1, ...rest } = {...props};
    let allProps = { min, max, step, ...rest};
    return <WrappedField type="number" FieldComponent={FlexInputField} FieldContainer={InlineFormField} {...allProps} />
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

function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1).toLowerCase();
}
