"use client"
import "@/app/page.css"
import Panel from "@/app/components/panels";

import { faSliders } from '@fortawesome/free-solid-svg-icons';
import { createPresetEntry, updatePresetEntry, deletePresetEntry } from '@/app/actions';
import Expandable from '@/app/components/expandable';
import { PanelItem, ItemHeader } from "@/app/components/panels";
import { TextField, TextArea, NumberField } from '@/app/components/common-forms';
import { formFactory, makeCreateForm, makeEditForm } from '@/app/components/form-factory';
import { getTopDownRenderer } from '@/app/components/fieldset-renderers';

export const fields = [{
  name: "name",
  component: TextField,
  id: "p_name",
  label: "Name"
}, {
  name: "temperature",
  component: NumberField,
  id: "temperature_create",
  label: "Temperature",
  min: 0,
  max: 10,
  step: 0.01
}, {
  name: "top_k",
  component: NumberField,
  id: "top_k_create",
  label: "Top K",
  min: 1,
  max: 10000,
  step: 1
}, {
  name: "top_p",
  component: NumberField,
  id: "top_p_create",
  label: "Top P",
  min: 0,
  max: 1,
  step: 0.01
}, {
  name: "min_p",
  component: NumberField,
  id: "min_p_create",
  label: "Min P",
  min: 0,
  max: 1,
  step: 0.01
}, {
  name: "repeat_penalty",
  component: NumberField,
  id: "repeat_penalty_create",
  label: "Repeat Penalty",
  min: -4,
  max: 4,
  step: 0.01
}, {
  name: "n_predict",
  component: NumberField,
  id: "n_predict_create",
  label: "Max tokens to predict",
  min: 0,
  max: 10000,
  step: 1
}, {
  name: "extra_params",
  component: TextArea,
  id: "extra_params_create",
  label: "Additional parameters"
}];

const PresetForm = formFactory(fields, getTopDownRenderer());
const CreatePresetForm = makeCreateForm(PresetForm, createPresetEntry);
const EditPresetForm = makeEditForm(PresetForm, updatePresetEntry);


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
          <strong>Frequency Penalty:</strong> {repeat_penalty}
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



export default function PresetPanel({ presets }) {
  const elements = presets.map((entry, idx) => <PresetItem key={idx} preset={entry} />);
  return (
    <Panel 
      title="Presets"
      icon={faSliders}
      elements={elements}
      createForm={CreatePresetForm}
      addButtonText="Add new preset"
    />
  );
}