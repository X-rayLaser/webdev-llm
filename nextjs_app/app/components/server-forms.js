"use client"

import React, { useState } from 'react';
import { TextField, TextArea, Form, SubmitButton, jsonPlaceholder } from './common-forms';
import { createServerEntry } from "@/app/actions";
import { Alert } from "./alerts";
import { useActionState } from 'react';

export const ServerForm = () => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [configuration, setConfiguration] = useState('');

  const [isDisabled, setDisabled] = useState(false);

  const initialState = { message: null, errors: {} };
  const [state, formAction] = useActionState(createServerEntry, initialState);

  const hasErrors = state => Object.keys(state.errors).length > 0;

  return (
    <Form action={formAction} variant={hasErrors(state) ? "danger" : "default"}>
      {/* Name Field */}
      <div className="mb-5">
        <TextField id="name" value={name} errors={state.errors?.name}
            onChange={(e) => setName(e.target.value)} />
      </div>

      {/* URL Field */}
      <div className="mb-5">
        <TextField id="url" label="URL" type="url" value={url} errors={state.errors?.url}
            onChange={(e) => setUrl(e.target.value)} />
      </div>

      <details>
        <summary className="mb-5 cursor-pointer">Optional fields</summary>
            {/* Description Field */}
        <div>
            <div className="mb-5">
                <TextArea id="description" label="Description" value={description}
                    errors={state.errors?.description}
                    onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Configuration Field */}
            
            <div className="mb-5">
                <TextArea id="configuration" value={configuration} placeholder={jsonPlaceholder}
                    errors={state.errors?.configuration}
                    onChange={(e) => setConfiguration(e.target.value)} />
            </div>
        </div>
      </details>

      {state.message && 
        <div className="mt-5 mb-5">
          <Alert text={state.message} level="danger" />
        </div>}
    
      <div className="flex justify-center">
          <SubmitButton onClick={() => setDisabled(true)} disabled={isDisabled} />
      </div>
    </Form>
  );
};


export default ServerForm;