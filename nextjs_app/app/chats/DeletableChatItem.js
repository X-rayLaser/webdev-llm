"use client"
import React, { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { ConfirmationModal } from "../components/modal";
import { deleteChat } from "../actions";

export function DeletableChatItem({ chat, maxLen = 25 }) {
  const [show, setShow] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleYes() {
    deleteChat(chat.id).then(result => setDeleting(false));
    setShow(false);
    setDeleting(true);
  }

  return (
    <div className="relative">
      <div key={chat.id} className="flex items-center gap-2 bg-white rounded-md">
        <img
          src={chat.image}
          alt={chat.name}
          className="w-12 h-12 rounded-l-md" />
        {!deleting && (
          <Link href={`/chats/${chat.id}`} className="text-blue-500 flex">
            <div className="max-w-44 overflow-hidden whitespace-nowrap inline-block">{chat.name}</div>
            <span>...</span>
          </Link>
        )}
        {deleting && (
          <div className="items-end">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span className="ml-2">Deleting chat...</span>
          </div>
        )}

        <ConfirmationModal
          show={show}
          onYes={handleYes}
          onClose={() => setShow(false)}
        >
          <div>Are you sure that you wish to delete the chat?</div>
        </ConfirmationModal>
      </div>
      <div className={`absolute right-2 top-0 h-12 flex justify-center items-center ${deleting ? "hidden" : ""}`}>
        <div className="text-red-400 hover:text-red-800 hover:cursor-pointer">
          <FontAwesomeIcon icon={faTrash} onClick={() => setShow(true)} />
        </div>
      </div>
      
    </div>
  );
}
