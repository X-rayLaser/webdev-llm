"use client"
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { Suspense } from 'react';
import Loader from "./Loader";
import { DeletableChatItem } from "./DeletableChatItem";
import { fetchChats } from "../utils";
import { Pagination } from "./Pagination";

export default function ChatSidePanel() {
  const queryParams = useSearchParams();
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


function ChatList({ queryParams }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();
  const params = useParams();
  const queryString = (new URLSearchParams(queryParams)).toString();

  const loadUrl = "http://localhost/api/chats/";

  function loadData(baseUrl, query="") {
    setLoading(true);

    fetchChats(baseUrl, query).then(([chats, pages]) => {
      const fallbackImage = "/app/test-image.jpeg";
      const fixedChats = chats.map(({ image, ...rest }) => ({
        image: image ? image.replace("django:8000", "localhost") : fallbackImage,
        ...rest
      }));

      setItems(fixedChats);
      setTotalPages(pages);
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    loadData(loadUrl, queryString);

  }, [queryParams]);

  function handleDeleted(chat) {
    if (params.id && params.id == chat.id) {
      router.push(`/chats/?${queryString}`);
    }
    setItems(prevItems => prevItems.filter(item => item.id !== chat.id));
  }

  const elements = items.map((chat, idx) => 
    <DeletableChatItem key={idx} chat={chat} queryString={queryString} 
      onDeleted={() => handleDeleted(chat)}/>
  );

  const itemsSection = (
    items.length > 0 ? <div className="space-y-2">{elements}</div> : <p className="text-center">No chats found.</p>
  );

  return (
    <div>
      {loading ? <Loader /> : itemsSection}

      {totalPages > 1 && (
        <Pagination totalPages={totalPages} inProgress={loading} />
      )}
    </div>
  );
}
