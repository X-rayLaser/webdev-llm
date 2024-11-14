import Image from "next/image";
import "@/app/page.css"
import ServerForm from "@/app/components/server-forms";
import PresetForm from "@/app/components/preset-forms";
import ConfigurationForm from "@/app/components/config-forms";
import ServerInfo from "@/app/configuration/server";


async function ServerPanel() {

  try {
    const response = await fetch("http://django:8000/api/servers/");

      
    if (response.ok) {
      const data = await response.json();
      //const data = [{ id: 1, name: "LLama.cpp server" }, { id: 2, name: "VLLM server" }];
      const servers = data.map((entry, idx) => <ServerInfo key={idx} server={entry} />);
      return (
        <div>
            <h4 className="mb-5">Servers</h4>
            {servers.length > 0 && <div>{servers}</div>}
            {servers.length === 0 && <h5>No servers has been created</h5>}
        </div>
      );
    }

    return (
      <div>Something went wrong</div>
    );
  } catch (error) {
    console.error("ERROR SERVER PANEL:", error);
    return <div>Failed to fetch data</div>
  }

}


export default function Page() {
  let presets = [{ id: 1, name: "Default" }, { id: 2, name: "Precise" }];

  let servers = [{ id: 1, name: "LLama.cpp server" }, { id: 2, name: "VLLM server" }];
  return (
    <div>
      <ServerPanel />
      <ServerForm />
      <PresetForm />
      <ConfigurationForm presets={presets} servers={servers} />
    </div>
  );
}
