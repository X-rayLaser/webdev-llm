"use client"
import React, { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function SearchBar({ queryParams }) {
  const { page, term="", advanced=false, sortby, filter } = queryParams;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  function updateSearchParams(newParams) {
    const params = new URLSearchParams(searchParams);

    newParams.forEach(({ name, value }) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    });

    replace(`${pathname}?${params.toString()}`);
  }

  const handleSearchChange = (e) => {
    const term = e.target.value;
    updateSearchParams([{ name: "term", value: term }, { name: "page", value: 1}]);
  };

  const handleAdvancedToggle = () => {
    setSettingsOpen(!settingsOpen);
  };

  const handleSortChange = (e) => {
    const sortOption = e.target.value;
    updateSearchParams([{ name: "sortby", value: sortOption }, { name: "page", value: 1}]);

  };

  const handleContentFilterChange = (e) => {
    const newFilter = e.target.value;
    updateSearchParams([{ name: "filter", value: newFilter }, { name: "page", value: 1}]);
  };

  return <div className="mb-4">
    <div className="flex items-center space-x-2 mb-2">
      <div className="relative flex-grow">
        <input
          type="text"
          defaultValue={term}
          onChange={handleSearchChange}
          placeholder="Search..."
          className="w-full border px-3 py-2 rounded pr-10" />
        <span className="absolute right-3 top-2 text-gray-500">
          🔍
        </span>
      </div>
      <button
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
    {settingsOpen && (
      <SearchSettings
        sortOption={sortby}
        contentFilter={filter}
        onSortChange={handleSortChange}
        onContentFilterChange={handleContentFilterChange} />
    )}
  </div>;
}

function SearchSettings({ sortOption, onSortChange, onContentFilterChange, contentFilter }) {
  const Radio = radioFactory("contentFilter", onContentFilterChange);

  return <div className="mt-2 space-y-2">
    {/* Sort Options */}
    <div>
      <label className="block text-sm font-medium">Sort By:</label>
      <select
        defaultValue={sortOption}
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
