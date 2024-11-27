import React from "react";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { DeletableChatItem } from "./DeletableChatItem";
import { fetchChats } from "../utils";

export default function ChatSidePanel({ queryParams }) {
  const { term="", sortby="newest", filter="all", page=1, advanced=false } = queryParams;
  const suspenseKey = term + page + sortby + filter;

  return (
    <div className="p-4 border-r overflow-y-auto bg-slate-200 h-dvh">
      {/* Search Form */}
      <SearchBar queryParams={queryParams} />


      <hr className="bg-gray-400 h-[2px] my-4" />
      {/* Chat List */}
      <Suspense key={suspenseKey} fallback={<Loader />}>
        <ChatList queryParams={queryParams} />
      </Suspense>
    </div>
  );
};

async function ChatList({ queryParams }) {
  const queryString = (new URLSearchParams(queryParams)).toString();

  const [ chats, totalPages ] = await fetchChats("http://django:8000/api/chats/", queryString);

  let items = [];
  if (chats && chats.length > 0) {
    items = chats.map((chat, idx) => <DeletableChatItem key={idx} chat={chat} />);
  }
  return (
    <div>
      {items.length > 0 ? <div className="space-y-2">{items}</div> : <p>No chats found.</p>}
      {/* Pagination */}
      {totalPages > 0 && (
        <Pagination queryParams={queryParams} totalPages={totalPages} />
      )}
    </div>
  );
}

function Pagination({ queryParams, totalPages }) {
  const { term="", page=1, advanced, filter } = queryParams;
  let pageNumber = Number(page);


  function buildUrl(pageNo) {
    const params = new URLSearchParams(queryParams);
    params.set("page", pageNo);
    return `/chats?${params.toString()}`;
  }
  
  const prevUrl = buildUrl(pageNumber - 1);
  const nextUrl = buildUrl(pageNumber + 1);
  
  return (
    <div className="mt-4 flex justify-between items-center">
      <Link 
        disabled={pageNumber === 1}
        href={prevUrl}
        className={`px-4 py-2 border rounded ${pageNumber === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Previous
      </Link>
      <span>
        Page {pageNumber} of {totalPages}
      </span>
      <Link 
        disabled={pageNumber === 1}
        href={nextUrl}
        className={`px-4 py-2 border rounded ${pageNumber === totalPages ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Next
      </Link>
    </div>
  );
}


function Loader() {
  return (
      <div className="mt-12">
          <div className="text-3xl text-center text-blue-800 font-semibold">
              <span>Loading... </span>
              <span><FontAwesomeIcon icon={faSpinner} spin size="lg"/></span>
          </div>
      </div>
  );
}
