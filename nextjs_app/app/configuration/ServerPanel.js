"use client"
import "@/app/page.css"
import Panel from "@/app/components/panels";
import { faServer } from '@fortawesome/free-solid-svg-icons'
import { TextField, TextArea } from '@/app/components/common-forms';
import { createServerEntry, updateServerEntry, deleteServerEntry } from "@/app/actions";
import { formFactory, makeCreateForm, makeEditForm } from '@/app/components/form-factory';
import Expandable from '@/app/components/expandable';
import { PanelItem, ItemHeader } from "@/app/components/panels";


const fields = [{
  name: "name",
  component: TextField,
  id: "server_name",
  label: "Name"
}, {
  name: "url",
  component: TextField,
  id: "server_url",
  label: "URL",
  type: "url"
}, {
  name: "description",
  component: TextArea,
  id: "server_description"
}, {
  name: "configuration",
  component: TextArea,
  id: "server_config"
}];


function renderFields(formFields, names, errorMessage, submitButton) {
  return (
    <div>
      <div className="mb-4">{formFields.name}</div>
      <div className="mb-4">{formFields.url}</div>
      <details>
        <summary className="mb-4 cursor-pointer">Optional fields</summary>
        <div>
          <div className="mb-4">{formFields.description}</div>
          <div className="mb-4">{formFields.configuration}</div>
        </div>
      </details>
      {errorMessage}
      {submitButton}
    </div>
  );
}

const ServerForm = formFactory(fields, renderFields);
const CreateServerForm = makeCreateForm(ServerForm, createServerEntry)
const EditServerForm = makeEditForm(ServerForm, updateServerEntry);


export function ServerItem({ server }) {
  const headerSection = <ItemHeader title={server.name} icon={faServer} />

  const bodySection = (
    <div>
      {/* URL */}
      <div>
        <span className="font-semibold">URL:</span>
        <a href={server.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-2">
          {server.url}
        </a>
      </div>

      <Expandable key={1}>
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
      </Expandable>
    </div>
  );

  return (
    <div>
      <PanelItem
        data={server}
        editComponent={EditServerForm}
        deleteAction={deleteServerEntry}
        headerSection={headerSection}
        bodySection={bodySection} />
    </div>
  );
}


export default function ServerPanel({ servers }) {
    const elements = servers.map((entry, idx) => <ServerItem key={idx} server={entry} />);
    return (
      <Panel 
        title="Servers"
        icon={faServer}
        elements={elements}
        createForm={CreateServerForm}
        addButtonText="Add new server"
      />
    );
}