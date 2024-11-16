"use client"
import React, { useState } from 'react';
import { TextField, NumberField, TextArea, Form } from './common-forms';
import { SubmitButton } from './buttons';


const ConfigurationForm = ({ presets, servers }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [preset, setPreset] = useState('');
  const [llmServer, setLlmServer] = useState('');
  const [autorun, setAutorun] = useState(false);
  const [maxIterations, setMaxIterations] = useState(1);

  return (
    <Form>
      <div className="mb-5">
        <TextField
          id="cname"
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <label htmlFor="autorun" className="font-semibold">Autorun</label>
        <input
          type="checkbox"
          id="autorun"
          checked={autorun}
          onChange={(e) => setAutorun(e.target.checked)}
          className="ml-2"
        />
      </div>

      <div className="mb-5">
        <NumberField
          id="max_iterations"
          label="Max Iterations"
          min={1}
          max={100}
          step={1}
          value={maxIterations}
          onChange={(e) => setMaxIterations(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <label htmlFor="preset" className="font-semibold">Preset</label>
        <select
          id="preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="block w-full border rounded-lg p-2"
        >
          <option value="" disabled>Select a preset</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label htmlFor="llm_server" className="font-semibold">LLM Server</label>
        <select
          id="llm_server"
          value={llmServer}
          onChange={(e) => setLlmServer(e.target.value)}
          className="block w-full border rounded-lg p-2"
        >
          <option value="" disabled>Select a server</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <TextArea
          id="system_message"
          label="System Message"
          value={systemMessage}
          onChange={(e) => setSystemMessage(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <TextArea
          id="config_description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex justify-center">
        <SubmitButton />
      </div>
    </Form>
  );
};

export default ConfigurationForm;
