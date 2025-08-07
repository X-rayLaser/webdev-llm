"use client"
import React from 'react';
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';

import { TextField, TextArea, SelectField, CheckboxField, NumberField } from '@/app/components/common-forms';
import { createConfigEntry, updateConfigEntry, deleteConfigEntry } from "@/app/actions";
import { formFactory, makeCreateForm, makeEditForm } from '@/app/components/form-factory';
import Expandable from '@/app/components/expandable';
import Panel, { PanelItem, ItemHeader } from "@/app/components/panels";
import { getTopDownRenderer } from '../components/fieldset-renderers';


function generateFields(servers, presets) {
    return [
      {
        name: "name",
        component: TextField,
        id: "create_configuration_name",
        label: "Name",
        placeholder: "Enter the configuration name",
      }, {
        name: "llm_model",
        component: TextField,
        id: "create_configuration_llm_model",
        label: "Model",
        placeholder: "Enter the LLM name",
      },
      {
        name: "description",
        component: TextArea,
        id: "create_configuration_description",
        label: "Description",
        placeholder: "Provide a brief description",
      },
      {
        name: "system_message",
        component: TextArea,
        id: "create_configuration_system_message",
        label: "System Message",
        placeholder: "Enter the system message",
      },
      {
        name: "coder_system_message",
        component: TextArea,
        id: "create_configuration_coder_system_message",
        label: "Coder's System Message",
        placeholder: "Create the system message template used in coding mode. {resources} will be replaced with a resources/assets uploaded for development.",
      },
      {
        name: "preset",
        component: SelectField,
        id: "create_configuration_preset",
        label: "Preset",
        options: presets.map(p => ({ label: p.name, value: p.name})),
        placeholder: "Select a preset",
      },
      {
        name: "llm_server",
        component: SelectField,
        id: "create_configuration_llm_server",
        label: "LLM Server",
        options: servers.map(s => ({ label: s.name, value: s.name})),
        placeholder: "Select an LLM server",
      },
      {
        name: "max_iterations",
        component: NumberField,
        id: "create_configuration_max_iterations",
        label: "Max Iterations",
        placeholder: "Enter the maximum number of iterations",
        min: 1,
        max: 100,
        step: 1
      },
      {
        name: "autorun",
        component: CheckboxField,
        id: "create_configuration_autorun",
        label: "Auto Run",
        type: "checkbox",
      },
    ];
}


export function ConfigItem({ config, editForm }) {
  //todo: convert to factory function
  if (!config) {
    return <div>No configuration data available.</div>;
  }

  const EditConfigForm = editForm;

  const {
    name,
    llm_model,
    preset,
    llm_server,
    autorun,
    max_iterations,
    description,
    system_message,
    coder_system_message
  } = config;

  const itemHeader = <ItemHeader title={config.name} icon={faScrewdriverWrench} />
  const itemBody = (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <strong>LLM name:</strong> {llm_model || "N/A"}
      </div>
      <div>
        <strong>Preset:</strong> {preset || "N/A"}
      </div>
      <div>
        <strong>LLM Server:</strong> {llm_server || "N/A"}
      </div>
      <div>
        <strong>Auto Run:</strong> {autorun ? "Enabled" : "Disabled"}
      </div>
      <div>
        <strong>Max Iterations:</strong> {max_iterations}
      </div>

      <Expandable>
      {/* Optional fields */}
      {description && (
        <div className="mt-4">
          <strong>Description:</strong>
          <p className="mt-1">{description}</p>
        </div>
      )}
      {system_message && (
        <div className="mt-4">
          <strong>System Message:</strong>
          <p className="mt-1">{system_message}</p>
        </div>
      )}
      {coder_system_message && (
        <div className="mt-4">
          <strong>Coder System Message:</strong>
          <p className="mt-1">{coder_system_message}</p>
        </div>
      )}
      </Expandable>
    </div>
  );

  return (
    <PanelItem 
        data={config}
        editComponent={EditConfigForm}
        deleteAction={deleteConfigEntry}
        headerSection={itemHeader}
        bodySection={itemBody}
    />
  );
}


export default function ConfigPanel({ servers, presets, configs }) {
    const fields = generateFields(servers, presets);
    
    const form = formFactory(fields, getTopDownRenderer());
    const CreateForm = makeCreateForm(form, createConfigEntry);
    const EditForm = makeEditForm(form, updateConfigEntry);
    
    const elements = configs.map((entry, idx) => <ConfigItem key={idx} config={entry} editForm={EditForm} />);

    return (
      <Panel 
        title="Configurations"
        icon={faScrewdriverWrench}
        elements={elements}
        createForm={CreateForm}
        addButtonText="Add new configuration"
      />
    );
}
