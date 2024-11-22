"use client"
import React from 'react';
import Expandable from '../components/expandable';

export function Card({ header, imageUrl, textTitle="Last message", prompt, lastMessage="", buttonLabel, onButtonClick, createdAt }) {
  return (
    <div className="border rounded-lg shadow-md bg-white w-full">
      {/* Header */}
      <div className="text-xl font-bold truncate p-4 rounded-t-lg bg-sky-900 text-gray-100">
        <h4>{header}</h4>
      </div>

      {/* Body */}
      <div className="flex h-52 overflow-hidden">
        {/* Image */}
        <div className="flex-shrink-0 h-full bg-gray-200">
          <img
            src={imageUrl}
            alt="Card Image"
            className="object-cover w-full h-full"
          />
        </div>

        {/* Text and Button */}
        <div className="ml-4 grow h-52">
          <div className="flex gap-8 max-h-36 mt-2">
            <div className="w-full">
              <h6 className="font-bold mb-2 text-center">First message:</h6>
              <p className="text-md text-gray-700 max-h-28 overflow-auto text-justify leading-2 pr-2">{prompt}</p>
            </div>
          </div>
        
          <button
            className="mt-4 self-start bg-blue-500 text-white px-8 py-1 text-sm rounded shadow hover:bg-blue-600"
            onClick={onButtonClick}
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      <div className="p-4">
        <Expandable collapsedHeight={150}>{lastMessage}</Expandable>
      </div>

      {/* Footer */}
      <div className="text-sm text-gray-500 text-left p-4 border-t">
        Created at: {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}
