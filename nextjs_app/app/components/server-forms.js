"use client"

import React, { useState } from 'react';
import { TextField, TextArea, Form, SubmitButton, jsonPlaceholder } from './common-forms';
import { createServerEntry } from "@/app/actions";
import { Alert } from "./alerts";
import { useActionState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';


export function ServerForm({ action, defaultName="", defaultUrl="", defaultDescription="", defaultConfiguration="", onSubmit, children }) {
  const [name, setName] = useState(defaultName);
  const [url, setUrl] = useState(defaultUrl);
  const [runningSubmission, setRunningSubmission] = useState(false);
  const [description, setDescription] = useState(defaultDescription);
  const [configuration, setConfiguration] = useState(defaultConfiguration);

  const initialState = { message: null, errors: {} };
  const [state, formAction] = useActionState(async function() {
    let res = await action(...arguments);
    //artificial delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    setRunningSubmission(false);
    return res;
  }, initialState);

  const hasErrors = state => state && Object.keys(state.errors).length > 0;

  function handleSubmit(e) {
    console.log("handling submit", e);
    setRunningSubmission(true);
  }

  const disabledButton = runningSubmission;

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      {/* Name Field */}
      <div className="mb-5">
        <TextField id="name" value={name} errors={state?.errors?.name}
            onChange={(e) => setName(e.target.value)}
            disabled={runningSubmission}    
        />
      </div>

      {/* URL Field */}
      <div className="mb-5">
        <TextField id="url" label="URL" type="url" value={url} errors={state?.errors?.url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={runningSubmission}
        />
      </div>

      <details>
        <summary className="mb-5 cursor-pointer">Optional fields</summary>
            {/* Description Field */}
        <div>
            <div className="mb-5">
                <TextArea id="description" label="Description" value={description}
                    errors={state?.errors?.description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={runningSubmission}
                />
            </div>

            {/* Configuration Field */}
            
            <div className="mb-5">
                <TextArea id="configuration" value={configuration} placeholder={jsonPlaceholder}
                    errors={state?.errors?.configuration}
                    onChange={(e) => setConfiguration(e.target.value)}
                    disabled={runningSubmission}
                />
            </div>
        </div>
      </details>

      {state?.message && 
        <div className="mt-5 mb-5">
          <Alert text={state.message} level="danger" />
        </div>}
    
      <div className="flex justify-center">
          <SubmitButton disabled={disabledButton}>
            {runningSubmission && <span className="ml-2"><FontAwesomeIcon icon={faCog} spin /></span>}
          </SubmitButton>
      </div>
    </form>
  );
};

export function CreateServerForm() {
  return (
    <div>
      <ServerForm action={createServerEntry}>
      </ServerForm>
    </div>
  );
}


export default CreateServerForm;