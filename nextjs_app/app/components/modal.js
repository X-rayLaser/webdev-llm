"use client"

import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRectangleXmark } from '@fortawesome/free-solid-svg-icons'

const Modal = ({ show = false, onClose, children }) => {
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
          <div className="">
            <div
              className="bg-white rounded-lg shadow-lg mt-10 transition-all transform scale-95"
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
                <h3>Add new server</h3>
                {/* Close Button */}

              </header>
              <div className="overflow-y-auto max-h-[80vh]">
              {children}
              </div>
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

export default Modal;
