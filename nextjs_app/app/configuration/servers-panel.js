"use client"
import ServerInfo from "@/app/configuration/server";
import Modal from "@/app/components/modal";
import CreateServerForm from "@/app/components/server-forms";
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


function ServerPanel({ servers }) {
  const [showModal, setShowModal] = useState(false);
  const serverElements = servers.map((entry, idx) => <ServerInfo key={idx} server={entry} />);

  return (
  <div className="border-2 rounded-md border-stone-700 p-4">
      <h4 className="mb-5 text-center font-bold">Servers</h4>
      {servers.length > 0 && <FlexRowPanel>{serverElements}</FlexRowPanel>}
      {servers.length === 0 && <h5>No servers has been created</h5>}
      <div className="mt-4 flex justify-center md:justify-start">
          <ProminentButton onClick={() => setShowModal(true)}>
            Add new server
          </ProminentButton>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6">
          <CreateServerForm onSuccess={() => setShowModal(false)} />
        </div>
      </Modal>
  </div>
  );
}

export default ServerPanel;