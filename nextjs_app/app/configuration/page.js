import "@/app/page.css"
import CreateServerForm from "@/app/components/server-forms";
import CreatePresetForm from "@/app/components/preset-forms";
import { getConfigurationForm } from "@/app/components/config-forms";
import Panel from "@/app/components/panels";
import { ServerItem } from "./ServerItem";
import PresetItem from "./PresetItem";
import ConfigItem from "./ConfigItem";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faServer, faSliders, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons'

function ServerPanel({ servers }) {
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


function PresetPanel({ presets }) {
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

function ConfigPanel({ servers, presets, configs }) {
  const elements = configs.map((entry, idx) => <ConfigItem key={idx} config={entry} />);

  const CreateFormComponent = getConfigurationForm;
  const formArgs = {
    servers, presets
  };

  return (
    <Panel 
      title="Configurations"
      icon={faScrewdriverWrench}
      elements={elements}
      createForm={CreateFormComponent}
      formArgs={formArgs}
      addButtonText="Add new configuration"
    />
  );
}


async function fetchData(url, errorMsg) {
  const response = await fetch(url);

  if (response.ok) {
    return await response.json();
  }

  throw errorMsg;
}

export default async function Page() {
  let servers = [];
  let presets = [];
  let configs = [];

  try {
    servers = await fetchData("http://django:8000/api/servers/", "Failed to fetch server entries");
    presets = await fetchData("http://django:8000/api/presets/", "Failed to fetch preset entries");
    configs = await fetchData("http://django:8000/api/configs/", "Failed to fetch configuration entries");
  } catch (error) {
    console.error(error);
    return <div>{error}</div>
  }

  return (
    <div>
      <div className="mt-4">
        <ServerPanel servers={servers} />
      </div>
      <div className="pt-4 pb-4">
        <PresetPanel presets={presets} />
      </div>

      <div className="pt-4 pb-4">
        <ConfigPanel servers={servers} presets={presets} configs={configs} />
      </div>

    </div>
  );
}
