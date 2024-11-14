"use client"
import React, { useState } from 'react';
import { TextField, TextArea, NumberField, Form, SubmitButton, jsonPlaceholder } from './common-forms';


const PresetForm = () => {
  const [name, setName] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [topK, setTopK] = useState(1000);
  const [topP, setTopP] = useState(0.95);
  const [minP, setMinP] = useState(0.05);
  const [repeatPenalty, setRepeatPenalty] = useState(1.2);
  const [nPredict, setNPredict] = useState(1000);
  const [extraParams, setExtraParams] = useState('');

  return (
    <Form>
      {/* Name Field */}
      <div className="mb-5">
        <TextField
          id="p_name"
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Temperature Field */}
      <div className="mb-5">
        <NumberField
          id="temperature"
          label="Temperature"
          min={0}
          max={100}
          type="number"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
      </div>

      {/* Top K Field */}
      <div className="mb-5">
        <NumberField
          id="top_k"
          label="Top K"
          min={1}
          max={100000}
          step={100}
          value={topK}
          onChange={(e) => setTopK(e.target.value)}
        />
      </div>

      {/* Top P Field */}
      <div className="mb-5">
        <NumberField
          id="top_p"
          label="Top P"
          value={topP}
          onChange={(e) => setTopP(e.target.value)}
        />
      </div>

      {/* Min P Field */}
      <div className="mb-5">
        <NumberField
          id="min_p"
          label="Min P"
          value={minP}
          onChange={(e) => setMinP(e.target.value)}
        />
      </div>

      {/* Repeat Penalty Field */}
      <div className="mb-5">
        <NumberField
          id="repeat_penalty"
          label="Repeat Penalty"
          max={100}
          value={repeatPenalty}
          onChange={(e) => setRepeatPenalty(e.target.value)}
        />
      </div>

      {/* N Predict Field */}
      <div className="mb-5">
        <NumberField
          id="n_predict"
          label="N Predict"
          min={1}
          max={10000}
          step={250}
          value={nPredict}
          onChange={(e) => setNPredict(e.target.value)}
        />
      </div>

      {/* Extra Params Field */}
      <div className="mb-5">
        <TextArea
          id="extra_params"
          label="Extra Params (JSON)"
          value={extraParams}
          placeholder={jsonPlaceholder}
          onChange={(e) => setExtraParams(e.target.value)}
        />
      </div>

      <div className="flex justify-center">
        <SubmitButton />
      </div>
    </Form>
  );
};

export default PresetForm;
