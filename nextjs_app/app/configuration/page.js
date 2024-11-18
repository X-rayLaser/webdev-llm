import "@/app/page.css"
import CreateServerForm from "@/app/components/server-forms";
import CreatePresetForm from "@/app/components/preset-forms";
import ConfigurationForm from "@/app/components/config-forms";
import Panel from "@/app/components/panels";
import { ServerItem } from "./ServerItem";
import PresetItem from "./PresetItem";


function ServerPanel({ servers }) {
  const elements = servers.map((entry, idx) => <ServerItem key={idx} server={entry} />);
  return (
    <Panel 
      title="Servers"
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
      elements={elements}
      createForm={CreatePresetForm}
      addButtonText="Add new preset"
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

  try {
    servers = await fetchData("http://django:8000/api/servers/", "Failed to fetch server entries");
    presets = await fetchData("http://django:8000/api/presets/", "Failed to fetch preset entries");
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

      <ConfigurationForm presets={presets} servers={servers} />
    </div>
  );
}
