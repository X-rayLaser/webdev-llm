"use client"
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faServer, faPencil, faTrash, faCog } from '@fortawesome/free-solid-svg-icons'
import { updateServerEntry, deleteServerEntry } from '@/app/actions';
import { ConfirmationModal } from '../components/modal';
import { EditServerForm } from '../components/server-forms';
import Modal from '../components/modal';


const Expandable = ({ collapsedHeight=0, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);
  const contentRef = useRef(null);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    // Check if content height exceeds 300px when the component mounts
    if (contentRef.current && contentRef.current.scrollHeight > collapsedHeight) {
      setIsExpandable(true);
    }
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Collapsible Content */}
      <div
        ref={contentRef}
        style={{
          maxHeight: isExpanded ? contentRef.current.scrollHeight : collapsedHeight,
          transition: 'max-height 0.3s ease',
        }}
        className="overflow-hidden"
      >
        <div>
          {children}
        </div>
      </div>

      {isExpandable && (
        <div className="flex justify-left items-start mt-2">
          <button
            onClick={toggleExpand}
            className="text-blue-600 hover:underline"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}
      {!isExpandable && <div className="mb-2"><button className="invisible"></button></div>}
    </div>
  );
};


const ServerInfo = ({ server }) => {
  const [deletion, setDeletion] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  //hack forcing update
  const [counter, setCounter] = useState(false);

  function handleTrashClick() {
    setShowDialog(true);
  }

  function handleConfirm() {
    setDeletion(true);
    setShowDialog(false);
    deleteServerEntry(server.id);
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

  return (
    <div className="border rounded-lg w-full md:w-96 h-auto">
      <header className="bg-blue-200 rounded-t-lg pt-2 pb-2 pl-4 pr-4 text-center">
        <h2 className="block text-lg font-bold p-0">
          {server.name}
          <span className="ml-2 text-white">
            <FontAwesomeIcon icon={faServer} size="lg" />
          </span>
        </h2>

      </header>

      <div className="p-4 flex flex-col justify-around">
        {/* URL */}
        <div>
          <span className="font-semibold">URL:</span> 
          <a href={server.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-2">
            {server.url}
          </a>
        </div>

        <Expandable key={counter}>
        {/* Description */}
        {server.description && (
          <div className="">
            <hr className="h-px my-4 bg-gray-200 border-0 dark:bg-gray-700" />
            <div className="font-semibold">Description:</div>
            <div>{server.description}</div>
          </div>
        )}

        {/* Configuration */}
        {server.configuration && (
          <div className="">
            <hr className="h-px my-4 bg-gray-200 border-0 dark:bg-gray-700" />
            <span className="font-semibold">Configuration:</span>
            <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(server.configuration, null, 2)}</pre>
          </div>
        )}

        </Expandable>

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
        <ConfirmationModal show={showDialog} onYes={handleConfirm} onClose={handleClose}>
          <div>Are you sure that you want to permanently delete a server entry {server.name}?</div>
        </ConfirmationModal>

        <Modal title="Edit server's entry" show={showForm} onClose={handleCloseForm}>
          <div className="p-6">
            <EditServerForm server={server} onSuccess={handleSuccessfulUpdate} />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ServerInfo;
