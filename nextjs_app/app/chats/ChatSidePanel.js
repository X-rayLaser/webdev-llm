import React from "react";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';


export default function ChatSidePanel({ queryParams }) {
  const { term="", sortby="newest", filter="all", page=1, advanced=false } = queryParams;
  const suspenseKey = term + page + sortby + filter;

  return (
    <div className="p-4 border-r overflow-y-auto bg-slate-200 h-dvh">
      {/* Search Form */}
      <SearchBar queryParams={queryParams} />

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

  const maxLen = 25;
  const truncate = text => text.length < maxLen ? text : text.substring(0, maxLen) + "...";

  return (
    <div className="space-y-4">
      {chats && chats.length > 0 ? (
        chats.map((chat) => (
          <div key={chat.id} className="flex items-center space-x-4">
            <img
              src="/app/test-image.jpeg"
              alt={chat.name}
              className="w-12 h-12 rounded" />
            <Link href={`/chats/${chat.id}`} className="text-blue-500">
              {truncate(chat.name)}
            </Link>
          </div>
        ))
      ) : (
        <p>No chats found.</p>
      )}
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


async function fetchChats(baseUrl, query) {
  let chats = [];
  let totalPages = 1;

  try {
      const extra = query ? `?${query}` : "";
      const response = await fetch(`${baseUrl}${extra}`);
      const data = await response.json();

      chats = data.results;
      // todo: modify API to return totalPages in response
      totalPages = Math.ceil(data.count / 2);
  } catch (error) {
      console.error("Failed to fetch chats:", error);
      throw error;
  }

  return [ chats, totalPages ];
}