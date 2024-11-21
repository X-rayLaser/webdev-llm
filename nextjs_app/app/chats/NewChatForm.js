"use client"
import React, { useState, useEffect, useRef } from "react";
import { AutoExpandingTextArea } from "../components/common-forms";

const NewChatForm = () => {
  const [text, setText] = useState("");

  const handleTextChange = (e) => setText(e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", { configuration, text });
  };

  const [configuration, setConfiguration] = useState("");

  const handleConfigurationChange = (e) => {
    setConfiguration(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full md:w-1/2 mx-auto">
      <div>
        <AutoExpandingTextArea
          name="prompt"
          value={text}
          onChange={handleTextChange}
          placeholder="Type here..."
        />
      </div>
      <div className="flex items-center mb-4">
        <label htmlFor="configuration" className="mr-4 font-medium">
          Configuration:
        </label>
        <select
          id="configuration"
          value={configuration}
          onChange={handleConfigurationChange}
          className="border px-3 py-2 rounded mr-4 w-full sm:w-auto shrink"
          required
        >
          <option value="" disabled>
            Select a configuration
          </option>
          <option value="config1">Configuration 1</option>
          <option value="config2">Configuration 2</option>
          <option value="config3">Configuration 3</option>
        </select>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Submit
        </button>
      </div>
    </form>
  );
};

export default NewChatForm;
