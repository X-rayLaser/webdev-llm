"use client"

import React from 'react';
import { Alert } from './alerts';


function FlexInputField(props) {
    let { extraInputClasses, ...other} = props;

    return (
        <input className={`ml-2 rounded-lg p-2 grow min-w-0 ${extraInputClasses}`}
            {...other}
        />
    );
}


function TextAreaField({ extraInputClasses, ...other }) {
    return (
        <textarea className={`block w-full rounded-lg p-2 ${extraInputClasses}`}
            rows={7}
            {...other}
        />
    )
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
    const extraLabelClasses = errors.length > 0 ? "text-red-600" : ""
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


function WrappedField({ id, label="", name="", placeholder="", errors=[], FieldComponent, FieldContainer, ...rest }) {
    label = label || capitalize(id);
    name = name || id;
    placeholder = placeholder || `Fill in "${id}"`;

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
