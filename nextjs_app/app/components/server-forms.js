"use client"

import React, { useState } from 'react';
import { TextField, TextArea, Form, jsonPlaceholder } from './common-forms';
import { SubmitButton } from './buttons';
import { createServerEntry, updateServerEntry } from "@/app/actions";
import { Alert } from "./alerts";
import { useActionState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { formFactory } from './form-factory';


const fields = [{
  name: "name",
  component: TextField,
  id: "server_name",
  label: "Name"
}, {
  name: "url",
  component: TextField,
  id: "server_url",
  label: "URL",
}, {
  name: "description",
  component: TextArea,
  id: "server_description"
}, {
  name: "configuration",
  component: TextArea,
  id: "server_config"
}];

function renderFields(formFields) {
  return (
    <div>
      <div className="mb-4">{formFields.name}</div>
      <div className="mb-4">{formFields.url}</div>
      <details>
        <summary className="mb-4 cursor-pointer">Optional fields</summary>
        <div>
          <div className="mb-4">{formFields.description}</div>
          <div className="mb-4">{formFields.configuration}</div>
        </div>
      </details>
    </div>
  );
}

const ServerForm = formFactory(fields, renderFields);


export function CreateServerForm({ onSuccess }) {
  return (
    <div>
      <ServerForm action={createServerEntry} onSuccess={onSuccess}>
      </ServerForm>
    </div>
  );
}

export function EditServerForm({ server, onSuccess }) {
  const { id, ...defaults } = server;
  const updateAction = updateServerEntry.bind(null, id);
  return (
    <div>
      <ServerForm defaults={defaults} action={updateAction} onSuccess={onSuccess}>
      </ServerForm>
    </div>
  );
}


export default CreateServerForm;