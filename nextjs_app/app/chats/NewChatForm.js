"use client"
import React from "react";
import { SelectField, AutoExpandingTextArea } from "../components/common-forms";
import { formFactory, makeCreateForm } from "../components/form-factory";
import { startNewChat } from "../actions";


function truncate(s, size) {
  if (!s) {
    return s;
  }

  if (s.length <= size) {
    return s;
  }
  return s.substring(0, size) + "...";
}


function generateFields(configs) {
  return [{
    name: "prompt",
    component: AutoExpandingTextArea,
    id: "chat_prompt",
    label: "Prompt",
    placeholder: "Enter a prompt text for a new chat here"
  }, {
    name: "configuration",
    component: SelectField,
    id: "chat_configuration",
    options: configs.map(config => 
      ({
        label: truncate(config.name, 16),
        value: `http://django:8000/api/configs/${config.id}/`
      })
    ) //because of using Hyperlinked serializer
  }];
}

function render(fieldsToRender, names, errorMessage, button) {
  return (
    <div>

      {fieldsToRender.prompt}
      <div className="mt-2 mb-2 md:flex md:items-center md:gap-4">
        {fieldsToRender.configuration}
        <div className="mt-2">
          {button}
        </div>
      </div>
      {errorMessage}
    </div>
  );
}

export default function NewChatForm({ configs }) {
  const fields = generateFields(configs);
  const form = formFactory(fields, render);
  const CreateForm = makeCreateForm(form, startNewChat);
  
  return <CreateForm />;
}
