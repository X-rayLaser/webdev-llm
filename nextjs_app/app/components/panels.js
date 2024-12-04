"use client"
import Modal from "@/app/components/modal";
import { useState } from "react";
import { ProminentButton } from "../components/buttons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil, faTrash, faCog, faServer } from '@fortawesome/free-solid-svg-icons'
import { ConfirmationModal } from '../components/modal';
import { Alert } from "./alerts";

function FlexRowPanel({ children }) {
  return (
    <div className="w-full">
      <div className="flex flex-row justify-center flex-wrap h-full gap-4 w-full items-start content-start">
        {children.map((child, idx) => (
          <div key={idx} className="flex w-full md:w-auto">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}


export default function Panel({ title, icon, addButtonText, noElementsText="No items so far", elements, createForm, formArgs }) {
  const [showModal, setShowModal] = useState(false);
  
  let CreateForm;
  if (formArgs) {
    //createForm is a component factory in this case
    CreateForm = createForm(formArgs);
  } else {
    //createForm is already a component
    CreateForm = createForm;
  }

  return (
  <div className="border-2 rounded-md shadow-lg border-stone-200 p-4">
      <h4 className="mb-5 text-center font-bold text-2xl">
        {title} <FontAwesomeIcon icon={icon} />
      </h4>
      {elements.length > 0 && <FlexRowPanel>{elements}</FlexRowPanel>}
      {elements.length === 0 && <h5 className="text-lg text-center">{noElementsText}</h5>}
      <div className="mt-4 flex justify-center md:justify-start">
          <ProminentButton onClick={() => setShowModal(true)}>
            {addButtonText}
          </ProminentButton>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6">
          <CreateForm onSuccess={() => setShowModal(false)} />
        </div>
      </Modal>
  </div>
  );
}


export function DeleteControl({ data, deleteAction, deletionTitle, deletionText="", size="lg" }) {
  deletionTitle = deletionTitle || "Do you want to proceed?";
  deletionText = deletionText || "Are you sure that you want to permanently delete the entry?";
  const [deletion, setDeletion] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState("");

  function handleTrashClick() {
    setShowDialog(true);
  }

  function handleConfirm() {
    setDeletion(true);
    setShowDialog(false);
    setError("");

    deleteAction(data.id).then(res => {
      if (!res.success) {
        setError(res.responseData);
      }
      setDeletion(false);
    });
  }

  function handleClose() {
    setShowDialog(false);
  }

  return (
    <div>
      <div>
        {!deletion && (
          <div>
            <button className="border p-1 text-zinc-600 hover:text-zinc-900 hover:bg-gray-500"
              onClick={handleTrashClick}>
              <FontAwesomeIcon icon={faTrash} size={size} />
            </button>
            {error && (
              <div className="py-2">
                <Alert text={error} level="danger" size="sm" />
              </div>
            )}
          </div>
        )}
        {deletion && (
          <div>
            <span>Deletion...</span>
            <span className="ml-2">
              <FontAwesomeIcon icon={faCog} spin></FontAwesomeIcon>
            </span>
          </div>
        )}
      </div>
      <ConfirmationModal title={deletionTitle} show={showDialog} onYes={handleConfirm} onClose={handleClose}>
        <div>{deletionText}</div>
      </ConfirmationModal>
    </div>
  );
}


export function Controls({ data, editComponent, componentArgs, deleteAction,
                     editTitle="Edit item", deletionTitle="", deletionText="", size="lg" }) {
  //todo: make use of DeleteControl component
  deletionTitle = deletionTitle || "Do you want to proceed?";
  deletionText = deletionText || "Are you sure that you want to permanently delete the entry?";
  const [deletion, setDeletion] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  
  //todo: remove this hack forcing update
  const [counter, setCounter] = useState(false);

  function handleTrashClick() {
    setShowDialog(true);
  }

  function handleConfirm() {
    setDeletion(true);
    setShowDialog(false);
    setError("");

    deleteAction(data.id).then(res => {
      if (!res.success) {
        setError(res.responseData);
      }
      setDeletion(false);
    });
  }

  function handleClose() {
    setShowDialog(false);
  }

  function handleCloseForm() {
    setShowForm(false);
  }

  function handleEditClick() {
    setShowForm(true);
    setError("");
  }

  function handleSuccessfulUpdate() {
    setShowForm(false);
    setCounter(counter + 1);
  }

  let EditFormComponent;
  if (componentArgs) {
    EditFormComponent = editComponent(componentArgs);
  } else {
    EditFormComponent = editComponent;
  }

  return (
    <div>
      <div>
        {!deletion && (
          <div>
            <button className="border rounded-s-md p-1 text-zinc-600 hover:text-zinc-900 hover:bg-gray-500"
              onClick={handleEditClick}>
              <FontAwesomeIcon icon={faPencil} size={size} />
            </button>
            <button className="border rounded-e-md p-1 text-zinc-600 hover:text-zinc-900 hover:bg-gray-500"
              onClick={handleTrashClick}>
              <FontAwesomeIcon icon={faTrash} size={size} />
            </button>
            {error && (
              <div className="py-2">
                <Alert text={error} level="danger" size="sm" />
              </div>
            )}
          </div>
        )}
        {deletion && (
          <div>
            <span>Deletion...</span>
            <span className="ml-2">
              <FontAwesomeIcon icon={faCog} spin></FontAwesomeIcon>
            </span>
          </div>
        )}
      </div>
      <ConfirmationModal title={deletionTitle} show={showDialog} onYes={handleConfirm} onClose={handleClose}>
        <div>{deletionText}</div>
      </ConfirmationModal>

      <Modal title={editTitle} show={showForm} onClose={handleCloseForm}>
        <div className="p-6">
          <EditFormComponent data={data} onSuccess={handleSuccessfulUpdate} />
        </div>
      </Modal>
    </div>
  );
}

export function PanelItem({ data, editComponent, componentArgs, deleteAction, headerSection, bodySection,
                            editTitle = "Edit item", deletionTitle = "", deletionText = "" }) {
  return (
    <div>
      <div className="border rounded-lg shadow w-full md:w-96 h-auto">
        {headerSection}
        <div className="p-4 flex flex-col justify-around">
          <div>{bodySection}</div>
          <div className="mt-4">
            <Controls 
              data={data}
              editComponent={editComponent}
              componentArgs={componentArgs}
              deleteAction={deleteAction}
              editTitle={editTitle}
              deletionTitle={deletionTitle}
              deletionText={deletionText} />
          </div>
        </div>
      </div>
    </div>
  );
}


export function ItemHeader({ title }) {
  return (
    <header className=" border-b-2 rounded-t-lg pt-2 pb-2 pl-4 pr-4 text-center">
      <h2 className="block text-lg font-bold p-0">
        {title}
      </h2>
    </header>
  );
}