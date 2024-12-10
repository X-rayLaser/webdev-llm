"use client"

export function RunningOperationsList({ operations }) {
    return (
        <div>
            {operations.map((op, idx) => <div key={idx}>Generating response for a {op.message}</div>)}
        </div>
    );
}