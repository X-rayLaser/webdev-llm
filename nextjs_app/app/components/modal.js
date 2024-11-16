"use client"

import React from "react";
import { ButtonGroup, DialogButton } from "./buttons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRectangleXmark } from '@fortawesome/free-solid-svg-icons'

const Modal = ({ title="Add new entry", show = false, onClose, children }) => {
  return (
    <>
      {show && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
          style={{
            animation: show ? "fadeIn 0.3s ease-out" : "fadeOut 0.3s ease-in",
          }}
        >
          {/* Modal Content */}
          <div
            className="bg-white rounded-lg shadow-lg mt-10 transition-all transform w-full md:w-1/2"
            style={{
              animation: show ? "slideDown 0.3s ease-out" : "slideUp 0.3s ease-in",
            }}
          >
            <header className="bg-sky-800 text-white text-2xl pt-2 pb-2 pl-6 pr-6 rounded-t-md">
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 float-right"
              >
                <FontAwesomeIcon icon={faRectangleXmark} />
              </button>
              <h3>{title}</h3>
              {/* Close Button */}

            </header>
            <div className="overflow-y-auto max-h-[80vh]">
            {children}
            </div>
          </div>
        </div>
      )}
      {/* Tailwind animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            transform: translateY(-20px);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export function ConfirmationModal({ title="Do you confirm the operation?", context="", show=false, onYes, onClose, children }) {
  return (
    <Modal show={show} title={title} onClose={onClose}>
      <div className="p-6">
        {children}
        <div className="mt-4">
          <ButtonGroup>
            <DialogButton className="ml-0 mr-0" onClick={onYes}>Yes</DialogButton>
            <DialogButton className="ml-0 mr-0" onClick={onClose}>No</DialogButton>
          </ButtonGroup>
        </div>
      </div>
    </Modal>
  );

}

export default Modal;
