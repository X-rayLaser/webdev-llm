import Image from "next/image";
import "@/app/page.css"
import CreateServerForm from "@/app/components/server-forms";
import PresetForm from "@/app/components/preset-forms";
import ConfigurationForm from "@/app/components/config-forms";
import ServerInfo from "@/app/configuration/server";


function FlexRowPanel({ children }) {
  return (
    <div className="w-full">
      <div className="flex flex-row justify-center flex-wrap h-full gap-4 w-full items-start content-start">
        {children.map((child, idx) => (
          <div key={idx} className="flex w-full md:w-auto">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}


async function ServerPanel() {

  try {
    const response = await fetch("http://django:8000/api/servers/");

    if (response.ok) {
      const data = await response.json();
      //const data = [{ id: 1, name: "LLama.cpp server" }, { id: 2, name: "VLLM server" }];
      const servers = data.map((entry, idx) => <ServerInfo key={idx} server={entry} />);
      return (
        <div className="border-2 rounded-md border-stone-700 p-4">
            <h4 className="mb-5 text-center font-bold">Servers</h4>
            {servers.length > 0 && <FlexRowPanel>{servers}</FlexRowPanel>}
            {servers.length === 0 && <h5>No servers has been created</h5>}
            <div className="mt-4 flex justify-center md:justify-start">
              <button className="pl-16 pr-16 pt-4 pb-4 bg-violet-900 hover:bg-violet-950 text-white border-2
                               border-white rounded-md text-lg font-semibold">
                Add new server
              </button>
            </div>
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
    <div className="md:w-3/4 ml-auto mr-auto">
      <div className="pt-4 pb-4">
        <ServerPanel />
      </div>
      <CreateServerForm />
      <PresetForm />
      <ConfigurationForm presets={presets} servers={servers} />
    </div>
  );
}
