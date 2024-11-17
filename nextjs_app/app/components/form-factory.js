"use client"

import React, { useState } from 'react';
import { SubmitButton } from './buttons';
import { Alert } from "./alerts";
import { useActionState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';


function cleanDefault(defaults, fieldName) {
    let defaultValue;
    if (defaults && defaults.hasOwnProperty(fieldName)) {
        let fieldVal = defaults[fieldName];
        if (fieldVal === 0) {
            defaultValue = 0;
        } else if (fieldVal === false) {
            defaultValue = false;
        } else if (fieldVal) {
            defaultValue = fieldVal;
        } else {
            defaultValue = "";
        }
    }

    return defaultValue
}

export function formFactory(fields, renderFields) {

    function FormComponent({ action, defaults, onSuccess }) {
        const states = {};
        const setters = {};
        const [runningSubmission, setRunningSubmission] = useState(false);

        for (let fieldSpec of fields) {
            let name = fieldSpec.name;
            let defaultValue = cleanDefault(defaults, name);
            let [value, setValue] = useState(defaultValue);
            states[name] = value;
            setters[name] = setValue;
        }

        const initialState = { message: null, errors: {} };
        const [formState, formAction] = useActionState(async function() {
            let res = await action(...arguments);
            //artificial delay
            await new Promise(resolve => setTimeout(resolve, 2000))
            setRunningSubmission(false);
            if (!res) {
                onSuccess();
            }
            return res;
        }, initialState);

        let elementsMapping = {};
        fields.forEach((spec, idx) => {
            const { name, component, ...props } = spec;
            let Component = component;
            const fieldValue = states[name];
            let fieldErrors = [];
            if (formState?.errors) {
                fieldErrors = formState.errors[name];
            }
            const setValue = setters[name];

            const element = (
                <div key={idx}>
                    <Component 
                        name={name}
                        value={fieldValue}
                        errors={fieldErrors}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={runningSubmission}
                        {...props} />
                </div>
            );

            elementsMapping[name] = element;
        });

        function handleSubmit(e) {
            console.log("handling submit", e);
            setRunningSubmission(true);
        }

        return (
            <form action={formAction} onSubmit={handleSubmit}>
                <div>{renderFields(elementsMapping)}</div>
                {formState?.message && (
                    <div className="mt-5 mb-5">
                        <Alert text={formState.message} level="danger" />
                    </div>
                )}
            
                <div className="flex justify-center">
                    <SubmitButton disabled={runningSubmission}>
                    {runningSubmission && <span className="ml-2"><FontAwesomeIcon icon={faCog} spin /></span>}
                    </SubmitButton>
                </div>
            </form>
        );
    }

    return FormComponent;
};