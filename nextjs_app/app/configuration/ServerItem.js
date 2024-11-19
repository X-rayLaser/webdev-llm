import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import { deleteServerEntry } from '@/app/actions';
import { EditServerForm } from '../components/server-forms';
import Expandable from '../components/expandable';
import { PanelItem } from "../components/panels";
import { ItemHeader } from '../components/panels';


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
