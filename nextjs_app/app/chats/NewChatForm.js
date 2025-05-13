"use client"
import React, { useState } from "react";
import { SelectField, AutoExpandingTextArea, TextField, FileField, AutoExpandingTextAreaField } from "../components/common-forms";
import { formFactory, makeCreateForm } from "../components/form-factory";
import { getTopDownRenderer } from "../components/fieldset-renderers";
import { createResource, deleteResource, startNewChat } from "../actions";
import { FixedSizeOutlineButton, DiscardButton } from "../components/buttons";
import Modal from "../components/modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSpinner } from "@fortawesome/free-solid-svg-icons";


const resourceFields = [{
  name: "dest_path",
  component: TextField,
  id: "resource_path_id",
  label: "Relative path",
  placeholder: "Path of the resource file relative to index.html"
}, {
  name: "mime_type",
  component: TextField,
  id: "resource_type_id",
  label: "Mime-type",
  placeholder: "e.g. image/png"
}, {
  name: "description",
  component: AutoExpandingTextAreaField,
  id: "resource_description_id"
}, {
  name: "file",
  component: FileField,
  id: "resource_file_id",
  label: "Uploaded file"
}];


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
  }, {
    name: "zipfile",
    component: FileField,
    id: "resource_zipfile_id",
    label: "Resources zip"
  }];
}

function renderChatForm(fieldsToRender, names, errorMessage, button) {
  return (
    <div className="flex flex-col gap-2">
      {fieldsToRender.prompt}
      {fieldsToRender.zipfile}
      <div className="md:flex md:items-center md:gap-4">
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
  const [showModal, setShowModal] = useState(false);
  const [resources, setResources] = useState([]);

  const [deletion, setDeletion] = useState(false);

  const resourceForm = formFactory(resourceFields, getTopDownRenderer());
  const CreateResourceForm = makeCreateForm(resourceForm, createResource);

  const fields = generateFields(configs);
  const form = formFactory(fields, renderChatForm);

  function createFormAction(prevState, formData) {
    if (resources.length) {
      const ids = resources.map(res => res.id);
      formData.append("resources", JSON.stringify(ids));
    }
    return startNewChat(prevState, formData);
  }

  function handleResourceCreated(result) {
    setResources(prev => [...prev, result.responseData]);
    setShowModal(false);
  }

  async function handleDeleteResource(id) {
    setDeletion(true);
    const result = await deleteResource(id);
    // todo: check errors
    setResources(prev => prev.filter(res => res.id !== id));
    setDeletion(false);
  }

  const CreateForm = makeCreateForm(form, createFormAction);
  
  const items = resources.map((res, id) => (
    <div key={id} className="border w-40 p-2">
      <div>
        <span>Relative path: </span>
        <span>{res.dest_path}</span>
      </div>
      <div>
        <span>Mime type</span>
        <span>{res.mime_type}</span>
      </div>
      <DiscardButton onClick={() => handleDeleteResource(res.id) } disabled={deletion}>
        {deletion ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faTrash} />} Delete
      </DiscardButton>
    </div>
  ));

  return (
    <div className="flex flex-col gap-4">
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6">
          <CreateResourceForm onSuccess={handleResourceCreated} />
        </div>
      </Modal>

      <div className="w-40">
        <FixedSizeOutlineButton onClick={() => setShowModal(true)}>
          Add resource
        </FixedSizeOutlineButton>
      </div>
      {resources.length > 0 && <div className="flex gap-2">{items}</div>}
      <CreateForm />
    </div>
  );
}
