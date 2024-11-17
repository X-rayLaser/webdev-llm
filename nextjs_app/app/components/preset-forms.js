"use client"
import React, { useState } from 'react';
import { TextField, TextArea, NumberField, Form, jsonPlaceholder } from './common-forms';
import { SubmitButton } from './buttons';
import { formFactory } from './form-factory';
import { createPresetEntry, updatePresetEntry } from '../actions';

const fields = [{
  name: "name",
  component: TextField,
  id: "p_name",
  label: "Name"
}, {
  name: "temperature",
  component: NumberField,
  id: "temperature_create",
  label: "Temperature",
  min: 0,
  max: 100
}, {
  name: "top_k",
  component: NumberField,
  id: "top_k_create",
  label: "Top K",
  min: 1,
  max: 10000,
  step: 50
}, {
  name: "top_p",
  component: NumberField,
  id: "top_p_create",
  label: "Top P",
  min: 0,
  max: 1
}, {
  name: "min_p",
  component: NumberField,
  id: "min_p_create",
  label: "Min P",
  min: 0,
  max: 1
}, {
  name: "repeat_penalty",
  component: NumberField,
  id: "repeat_penalty_create",
  label: "Repeat Penalty",
  min: -4,
  max: 4
}, {
  name: "n_predict",
  component: NumberField,
  id: "n_predict_create",
  label: "Max tokens to predict",
  min: 0,
  max: 10000,
  step: 256
}, {
  name: "extra_params",
  component: TextArea,
  id: "extra_params_create",
  label: "Additional parameters"
}];

function renderFields(formFields) {
  console.log("renderfields", formFields)
  return (
    <div>
      <div className="mb-4">{formFields.name}</div>
      <div className="mb-4">{formFields.temperature}</div>
      <div className="mb-4">{formFields.top_k}</div>
      <div className="mb-4">{formFields.top_p}</div>
      <div className="mb-4">{formFields.min_p}</div>
      <div className="mb-4">{formFields.repeat_penalty}</div>
      <div className="mb-4">{formFields.n_predict}</div>
      <div className="mb-4">{formFields.extra_params}</div>
    </div>
  );
}

const PresetForm = formFactory(fields, renderFields);

export function CreatePresetForm({ onSuccess }) {
  return (
    <div>
      <PresetForm action={createPresetEntry} onSuccess={onSuccess}>
      </PresetForm>
    </div>
  );
}


export function EditPresetForm({ data, onSuccess }) {
  const { id, ...defaults } = data;
  const updateAction = updatePresetEntry.bind(null, id);
  return (
    <div>
      <PresetForm defaults={defaults} action={updateAction} onSuccess={onSuccess}>
      </PresetForm>
    </div>
  );
}


export default CreatePresetForm;
