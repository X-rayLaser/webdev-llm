"use client"
import React from "react";
import { SelectField, AutoExpandingTextArea } from "../components/common-forms";
import { formFactory } from "../components/form-factory";

const fields = [{
  name: "prompt",
  component: AutoExpandingTextArea,
  id: "chat_prompt",
  label: "Prompt",
  placeholder: "Enter a prompt text for a new chat here"
}, {
  name: "configuration",
  component: SelectField,
  id: "chat_configuration",
  options: [{ label: "config1", value: "32" }, { label: "config2", value: "33" }  ]
}];

function render(fieldsToRender, names, errorMessage, button) {
  return (
    <div>

      {fieldsToRender.prompt}
      <div className="flex items-center mt-2 mb-2 gap-4">
        {fieldsToRender.configuration}
        {button}
      </div>
      {errorMessage}
    </div>
  );
}

const NewChatForm = formFactory(fields, render);

export default NewChatForm;
