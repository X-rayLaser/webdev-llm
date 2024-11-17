"use client"
import Modal from "@/app/components/modal";
import { useState } from "react";
import { ProminentButton } from "../components/buttons";

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