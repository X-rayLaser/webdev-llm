"use client"
import Modal from "@/app/components/modal";
import { useState } from "react";
import { ProminentButton } from "../components/buttons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil, faTrash, faCog } from '@fortawesome/free-solid-svg-icons'
import { ConfirmationModal } from '../components/modal';


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


export default function Panel({ title, noElementsText="No items so far", elements, createForm }) {
  const [showModal, setShowModal] = useState(false);
  const CreateForm = createForm;
  return (
  <div className="border-2 rounded-md border-stone-700 p-4">
      <h4 className="mb-5 text-center font-bold">{title}</h4>
      {elements.length > 0 && <FlexRowPanel>{elements}</FlexRowPanel>}
      {elements.length === 0 && <h5>{noElementsText}</h5>}
      <div className="mt-4 flex justify-center md:justify-start">
          <ProminentButton onClick={() => setShowModal(true)}>
            Add new server
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


export function PanelItem({ data, editComponent, deleteAction, headerSection, bodySection, 
                     editTitle="Edit item", deletionTitle="", deletionText="" }) {
  deletionTitle = deletionTitle || "Do you want to proceed?";
  deletionText = deletionText || "Are you sure that you want to permanently delete the entry?";
  const [deletion, setDeletion] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  //todo: remove this hack forcing update
  const [counter, setCounter] = useState(false);

  function handleTrashClick() {
    setShowDialog(true);
  }

  function handleConfirm() {
    setDeletion(true);
    setShowDialog(false);
    deleteAction(data.id);
  }

  function handleClose() {
    setShowDialog(false);
  }

  function handleCloseForm() {
    setShowForm(false);
  }

  function handleEditClick() {
    setShowForm(true);
  }

  function handleSuccessfulUpdate() {
    setShowForm(false);
    setCounter(counter + 1);
  }

  const EditFormComponent = editComponent;

  return (
    <div className="border rounded-lg w-full md:w-96 h-auto">
      {headerSection}
      <div className="p-4 flex flex-col justify-around">
        <div>{bodySection}</div>
        <div className="mt-4">
          {!deletion && (
            <div>
              <button className="border p-1 text-zinc-600 hover:text-zinc-900 hover:bg-gray-500"
                onClick={handleEditClick}>
                <FontAwesomeIcon icon={faPencil} size="lg" />
              </button>
              <button className="border p-1 text-zinc-600 hover:text-zinc-900 hover:bg-gray-500"
                onClick={handleTrashClick}>
                <FontAwesomeIcon icon={faTrash} size="lg" />
              </button>
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
