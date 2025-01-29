import "@/app/page.css"
import ServerPanel from "./ServerPanel";
import PresetPanel from "./PresetPanel";
import ConfigPanel from "./ConfigPanel";


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

export const dynamic = 'force-dynamic';