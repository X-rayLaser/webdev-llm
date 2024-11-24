"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";


export default function ChatSidePanel({ chats, totalPages }) {
  //const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [contentFilter, setContentFilter] = useState("all");
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Sync search params with UI state
  useEffect(() => {
    const term = searchParams.get("term") || "";
    const currentPage = parseInt(searchParams.get("page") || "1", 10);
    setSearchTerm(term);
    setPage(currentPage);
  }, [searchParams]);

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    router.push(`/chats?term=${term}&page=1`);
  };

  const handleAdvancedToggle = () => {
    setAdvancedSettingsOpen(!advancedSettingsOpen);
  };

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
    router.push(`/chats?term=${searchTerm}&page=1`);
  };

  const handleContentFilterChange = (e) => {
    setContentFilter(e.target.value);
    router.push(`/chats?term=${searchTerm}&page=1`);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    router.push(`/chats?term=${searchTerm}&page=${newPage}`);
  };

  return (
    <div className="p-4 border-r overflow-y-auto bg-slate-200 h-dvh">
      {/* Search Form */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search..."
              className="w-full border px-3 py-2 rounded pr-10"
            />
            <span className="absolute right-3 top-2 text-gray-500">
              🔍
            </span>
          </div>
          <button
            onClick={() => router.push(`/chats?term=${searchTerm}&page=1`)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go
          </button>
        </div>
        <button
          onClick={handleAdvancedToggle}
          className="text-sm text-gray-700 flex items-center space-x-2"
        >
          ⚙️ Advanced settings
        </button>
        {advancedSettingsOpen && (
          <SearchSettings
            sortOption={sortOption}
            contentFilter={contentFilter}
            onSortChange={handleSortChange}
            onContentFilterChange={handleContentFilterChange} />
        )}
      </div>

      {/* Chat List */}
      <ChatList chats={chats} />

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
};

function SearchSettings({ sortOption, onSortChange, onContentFilterChange, contentFilter }) {
  const Radio = radioFactory("contentFilter", onContentFilterChange);

  return <div className="mt-2 space-y-2">
    {/* Sort Options */}
    <div>
      <label className="block text-sm font-medium">Sort By:</label>
      <select
        value={sortOption}
        onChange={onSortChange}
        className="w-full border px-3 py-2 rounded"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </div>
    {/* Content Filter */}
    <div>
      <label className="block text-sm font-medium">Content Filter:</label>
      <div className="flex items-center space-x-2">
        <Radio label="All" value="all" checked={contentFilter === "all"} />
        <Radio label="With Code" value="withCode" checked={contentFilter === "withCode"} />
        <Radio label="No Code" value="noCode" checked={contentFilter === "noCode"} />
      </div>
    </div>
  </div>;
}

function ChatList({ chats }) {
  const maxLen = 25;
  const truncate = text => text.length < maxLen ? text : text.substring(0, maxLen) + "...";
  return (
    <div className="space-y-4">
      {chats.length > 0 ? (
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
    </div>
  );
}

function Pagination({ page, onPageChange, totalPages }) {
  return (
    <div className="mt-4 flex justify-between items-center">
      <button
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className={`px-4 py-2 border rounded ${page === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        className={`px-4 py-2 border rounded ${page === totalPages ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Next
      </button>
    </div>
  );
}


function RadioButton({ label, type="radio",  ...rest }) {
  return (
    <div>
      <label>
        <input type="radio" {...rest} />{" "}
        {label}
      </label>
    </div>
  );
}

function radioFactory(name, onChange) {
  function Component(props) {
    return <RadioButton name={name} onChange={onChange} {...props} />
  }
  return Component;
}