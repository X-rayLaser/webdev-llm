"use client"
/*
const hostWithPort = location.host;
const host = location.hostname || (hostWithPort && hostWithPort.split(":")[0]);

const socket = new WebSocket(`ws://${host}:9000`);

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

let n = getRandomInt(Math.pow(2, 31));
let socketSessionId = `${n}`;

socket.addEventListener("open", (event) => {
    socket.send(socketSessionId);
});
*/

export function RunningOperationsList({ operations }) {
    return (
        <div>
            {operations.map((op, idx) => <div>Generating response for a {op.message.id}</div>)}
        </div>
    );
}