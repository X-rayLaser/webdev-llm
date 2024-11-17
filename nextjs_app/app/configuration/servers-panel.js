"use client"
import ServerInfo from "@/app/configuration/server";
import CreateServerForm from "@/app/components/server-forms";


function ServerPanel({ servers }) {
  const serverElements = servers.map((entry, idx) => <ServerInfo key={idx} server={entry} />);
  return <Panel title="Server entries" elements={serverElements} createForm={CreateServerForm} />
}

export default ServerPanel;