import "@/app/page.css"
import CreateServerForm from "@/app/components/server-forms";
import CreatePresetForm from "@/app/components/preset-forms";
import ConfigurationForm from "@/app/components/config-forms";
import ServerInfo from "@/app/configuration/server";
import Panel from "@/app/components/panels";


function ServerPanel({ servers }) {
  const serverElements = servers.map((entry, idx) => <ServerInfo key={idx} server={entry} />);
  return <Panel title="Servers" elements={serverElements} createForm={CreateServerForm} />
}

/*
function PresetPanel({ servers }) {
  const serverElements = servers.map((entry, idx) => <ServerInfo key={idx} server={entry} />);
  return <Panel title="Presets" elements={serverElements} createForm={CreatePresetForm} />
}
*/


export default async function Page() {
  let presets = [{ id: 1, name: "Default" }, { id: 2, name: "Precise" }];

  let servers = [];

  try {
    const response = await fetch("http://django:8000/api/servers/");

    if (response.ok) {
      servers = await response.json();
    } else {
      return (
        <div>Something went wrong</div>
      );
    }

  } catch (error) {
    console.error("ERROR SERVER PANEL:", error);
    return <div>Failed to fetch data</div>
  }

  return (
    <div className="md:w-3/4 ml-auto mr-auto">
      <div className="pt-4 pb-4">
        <ServerPanel servers={servers} />
      </div>

      <CreatePresetForm />
      <ConfigurationForm presets={presets} servers={servers} />
    </div>
  );
}
