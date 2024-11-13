"use client"

import React, { useState } from 'react';
import { TextField, TextArea, Form, SubmitButton, jsonPlaceholder } from './common-forms';


export const ServerForm = () => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [configuration, setConfiguration] = useState('');

  return (
    <Form className="border rounded-lg border-stone-400 p-6 text-gray-800 max-w-md bg-slate-200">
      {/* Name Field */}
      <div className="mb-5">
        <TextField id="name" value={name}
            onChange={(e) => setName(e.target.value)} />
      </div>

      {/* URL Field */}
      <div className="mb-5">
        <TextField id="url" label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>

      <details>
        <summary className="mb-5 cursor-pointer">Optional fields</summary>
            {/* Description Field */}
        <div>
            <div className="mb-5">
                <TextArea id="description" label="Description" value={description}
                    onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Configuration Field */}
            
            <div className="mb-5">
                <TextArea id="configuration" value={configuration} placeholder={jsonPlaceholder}
                    onChange={(e) => setConfiguration(e.target.value)} />
            </div>
        </div>
        </details>
    
        <div className="flex justify-center">
            <SubmitButton />
        </div>
    </Form>
  );
};


export default ServerForm;