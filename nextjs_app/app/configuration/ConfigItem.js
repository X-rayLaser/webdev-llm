import React from 'react';
import { ItemHeader } from '../components/panels';
import { deleteConfigEntry } from '../actions';
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons'
import { PanelItem } from "../components/panels";
import { EditPresetForm } from '../components/preset-forms';
import Expandable from '../components/expandable';

export default function ConfigItem({ config }) {
  //todo: convert to factory function
  if (!config) {
    return <div>No configuration data available.</div>;
  }

  const {
    name,
    preset,
    llm_server,
    autorun,
    max_iterations,
    description,
    system_message,
  } = config;

  const itemHeader = <ItemHeader title={config.name} icon={faScrewdriverWrench} />
  const itemBody = (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <strong>Preset:</strong> {preset || "N/A"}
      </div>
      <div>
        <strong>LLM Server:</strong> {llm_server || "N/A"}
      </div>
      <div>
        <strong>Auto Run:</strong> {autorun ? "Enabled" : "Disabled"}
      </div>
      <div>
        <strong>Max Iterations:</strong> {max_iterations}
      </div>

      <Expandable>
      {/* Optional fields */}
      {description && (
        <div className="mt-4">
          <strong>Description:</strong>
          <p className="mt-1">{description}</p>
        </div>
      )}
      {system_message && (
        <div className="mt-4">
          <strong>System Message:</strong>
          <p className="mt-1">{system_message}</p>
        </div>
      )}
      </Expandable>
    </div>
  );

  return (
    <PanelItem 
        data={config}
        editComponent={EditPresetForm}
        deleteAction={deleteConfigEntry}
        headerSection={itemHeader}
        bodySection={itemBody}
    />
  );
}
