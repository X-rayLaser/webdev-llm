import Image from "next/image";
import "@/app/page.css"


export default function Home() {
  let presets = [{ id: 1, name: "Default" }, { id: 2, name: "Precise" }];

  let servers = [{ id: 1, name: "LLama.cpp server" }, { id: 2, name: "VLLM server" }];
  return (
    <div>
      <div className="my-grid-item">Greeting!</div>
    </div>
  );
}
