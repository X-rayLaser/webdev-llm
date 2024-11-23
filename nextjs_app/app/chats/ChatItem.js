"use client"
import React from 'react';
import Expandable from '../components/expandable';
import { OutlineButton } from '../components/buttons';

export function Card({ header, imageUrl, textTitle="Last message", prompt, lastMessage="", buttonLabel, onButtonClick, createdAt }) {
  const maxLen = 40;
  header = header.length < maxLen ? header : `${header.substring(0, maxLen)}...`;

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
        <div className="grow h-52 bg-sky-800">
          <h6 className="font-bold text-left text-lg text-white ml-4 my-2 leading-4 h-4">Prompt:</h6>
          <div className="max-h-40 mx-4 bg-white overflow-auto rounded-lg shadow p-2">
            <p className="text-md text-gray-700 text-justify leading-2">{prompt}</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-100">
        <h6 className="font-bold text-left text-lg mb-2">Last message:</h6>
        <Expandable collapsedHeight={150}>{lastMessage}</Expandable>
        <div className="mt-4">
          <OutlineButton onClick={onButtonClick}>{buttonLabel}</OutlineButton>
        </div>
      </div>

      {/* Footer */}
      <div className="text-sm text-gray-200 bg-gray-700 text-left p-4 border-t rounded-b-lg">
        Created at: {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}
