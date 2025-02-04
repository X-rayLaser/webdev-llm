"use client"

import React, { useState } from 'react';
import { SubmitButton } from './buttons';
import { Alert } from "./alerts";
import { useActionState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';


function cleanDefault(defaults, fieldName, type) {
    let defaultValue = (type === "checkbox" ? false : "");

    if (defaults && defaults.hasOwnProperty(fieldName)) {
        let fieldVal = defaults[fieldName];
        if (fieldVal === 0) {
            defaultValue = 0;
        } else if (fieldVal === false) {
            defaultValue = false;
        } else if (fieldVal) {
            defaultValue = fieldVal;
        }
    }

    return defaultValue
}

export function formFactory(fields, renderFields, buttonComponent=null, submitButtonText="Submit") {

    const ButtonComponent = buttonComponent || SubmitButton;

    function FormComponent({ action, defaults, onSuccess }) {
        const states = {};
        const setters = {};
        const [runningSubmission, setRunningSubmission] = useState(false);

        for (let fieldSpec of fields) {
            let name = fieldSpec.name;
            let defaultValue = cleanDefault(defaults, name, fieldSpec.type);
            // eslint-disable-next-line react-hooks/rules-of-hooks
            let [value, setValue] = useState(defaultValue);
            states[name] = value;
            setters[name] = setValue;
        }

        const initialState = { message: null, errors: {} };
        const [formState, formAction] = useActionState(async function() {
            let res = await action(...arguments);

            setRunningSubmission(false);
            if (res.success) {
                onSuccess(res, states);
            } else {
                return res.responseData;
            }
        }, initialState);

        let elementsMapping = {};
        let elementNames = [];

        fields.forEach((spec, idx) => {
            const { name, component, ...props } = spec;
            let Component = component;
            const value = states[name];
            let errors = [];
            if (formState?.errors) {
                errors = formState.errors[name];
            }
            const setValue = setters[name];

            function onChange(e) {
                let newValue;
                switch (spec.type) {
                    case "checkbox":
                        newValue = e.target.checked;
                        break;
                    case "file":
                        //e is file
                        newValue = e;
                        break;
                    default:
                        newValue = e.target.value;
                }
                setValue(newValue);
            }

            const componentProps = {
                name,
                value,
                errors,
                onChange,
                disabled: runningSubmission,
                ...props
            }
            
            if (spec.type === "checkbox") {
                componentProps.checked = value;
            }

            const element = (
                <div key={idx}>
                    <Component {...componentProps} />
                </div>
            );

            elementsMapping[name] = element;
            elementNames.push(name);
        });

        const submitButton = (
            <div>
                <ButtonComponent disabled={runningSubmission} text={submitButtonText}>
                {runningSubmission && <span className="ml-2"><FontAwesomeIcon icon={faCog} spin /></span>}
                </ButtonComponent>
            </div>
        );

        let errorMessageBlock = <div></div>;
        if (formState?.message) {
            errorMessageBlock = (
                <div className="mt-5 mb-5">
                    <Alert text={formState.message} level="danger" />
                </div>
            );
        }

        function handleSubmit(e) {
            console.log("handling submit", e);
            setRunningSubmission(true);
        }

        return (
            <form action={formAction} onSubmit={handleSubmit}>
                <div>{renderFields(elementsMapping, elementNames, errorMessageBlock, submitButton)}</div>
            </form>
        );
    }

    return FormComponent;
};


export function makeCreateForm(actionlessForm, actionCreate, defaults) {
    const FormComponent = actionlessForm;

    function CreateForm({ onSuccess }) {
        return (
            <div>
                <FormComponent action={actionCreate} onSuccess={onSuccess} defaults={defaults || {}}>
                </FormComponent>
            </div>
        );
    }

    return CreateForm;
}


export function makeEditForm(actionlessForm, actionUpdate) {
    const FormComponent = actionlessForm;

    function EditForm({ data, onSuccess }) {
        const { id, ...defaults } = data;
        const updateAction = actionUpdate.bind(null, id);
        return (
            <div>
                <FormComponent defaults={defaults} action={updateAction} onSuccess={onSuccess}>
                </FormComponent>
            </div>
        );
    }

    return EditForm;
}