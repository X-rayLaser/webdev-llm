import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders } from '@fortawesome/free-solid-svg-icons';
import { deletePresetEntry } from '@/app/actions';
import { EditPresetForm } from "@/app/components/preset-forms";
import Expandable from '../components/expandable';
import { PanelItem } from "../components/panels";
import { ItemHeader } from "../components/panels";

const PresetItem = ({ preset }) => {
  if (!preset) {
    return <p>No Preset Data Available</p>;
  }

  const {
    name,
    temperature,
    top_k,
    top_p,
    min_p,
    repeat_penalty,
    n_predict,
    extra_params,
  } = preset;

  const headerSection = <ItemHeader title={preset.name} icon={faSliders} />

  const bodySection = (
    <div className="">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <strong>Temperature:</strong> {temperature}
        </div>
        <div>
          <strong>Top K:</strong> {top_k}
        </div>
        <div>
          <strong>Top P:</strong> {top_p}
        </div>
        <div>
          <strong>Min P:</strong> {min_p}
        </div>
        <div>
          <strong>Repeat Penalty:</strong> {repeat_penalty}
        </div>
        <div>
          <strong>Max tokens:</strong> {n_predict}
        </div>

        <div className="col-span-2"> 
            <Expandable key={1}>
                {extra_params && (
                    <div>
                        <strong>Extra Parameters:</strong>{" "}

                        <pre className="bg-gray-100 p-2 rounded">
                        {JSON.stringify(extra_params, null, 2)}
                        </pre>
                    </div>
                )}
            </Expandable>
        </div>
      </div>
    </div>
  );

  return (
    <PanelItem 
        data={preset}
        editComponent={EditPresetForm}
        deleteAction={deletePresetEntry}
        headerSection={headerSection}
        bodySection={bodySection}
    />
  );
};

export default PresetItem;
