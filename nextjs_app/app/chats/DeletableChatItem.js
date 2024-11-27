"use client"
import React, { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { ConfirmationModal } from "../components/modal";
import { deleteChat } from "../actions";

export function DeletableChatItem({ chat, maxLen = 25 }) {
  const [show, setShow] = useState(false);
  const truncate = text => text.length < maxLen ? text : text.substring(0, maxLen) + "...";

  function handleYes() {
    deleteChat(chat.id);
    setShow(false);
  }

  return (
    <div className="relative">
      <div key={chat.id} className="flex items-center gap-4">
        <img
          src="/app/test-image.jpeg"
          alt={chat.name}
          className="w-12 h-12 rounded" />
        <Link href={`/chats/${chat.id}`} className="text-blue-500">
          {truncate(chat.name)}
        </Link>

        <ConfirmationModal
          show={show}
          onYes={handleYes}
          onClose={() => setShow(false)}
        >
          <div>Are you sure that you wish to delete the chat?</div>
        </ConfirmationModal>
      </div>
      <div className="absolute right-0 top-0 h-12 flex justify-center items-center">
        <FontAwesomeIcon icon={faTrash} onClick={() => setShow(true)} />
      </div>
      
    </div>
  );
}
