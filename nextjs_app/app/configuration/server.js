import React from 'react';

const ServerInfo = ({ server }) => {
  return (
    <div className="border rounded-lg max-w-96">
      <header className="bg-blue-200 rounded-t-lg pt-2 pb-2 pl-4 pr-4 text-center">
        <h2 className="block text-lg font-bold p-0">
          {server.name}
        </h2>
      </header>

      <div className="p-4 flex flex-col justify-around">

      {/* URL */}
      <div>
        <span className="font-semibold">URL:</span> 
        <a href={server.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-2">
          {server.url}
        </a>
      </div>

      {/* Description */}
      {server.description && (
        <div className="">
          <hr className="h-px my-4 bg-gray-200 border-0 dark:bg-gray-700" />
          <div className="font-semibold">Description:</div>
          <div>{server.description}</div>
        </div>
      )}

      {/* Configuration */}
      {server.configuration && (
        <div className="">
          <hr className="h-px my-4 bg-gray-200 border-0 dark:bg-gray-700" />
          <span className="font-semibold">Configuration:</span>
          <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(server.configuration, null, 2)}</pre>
        </div>
      )}
      </div>
    </div>
  );
};

export default ServerInfo;
