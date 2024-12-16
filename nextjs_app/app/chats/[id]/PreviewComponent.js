import React, { useEffect, useState } from 'react';
import { launchBuild } from '@/app/actions';
import { Button } from '@/app/components/buttons';
import { fetchDataFromUrl, fetchStatesData } from '@/app/data';

const calculateDuration = (startTime, endTime = new Date()) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffInSeconds = Math.floor((end - start) / 1000);

    const hours = Math.floor(diffInSeconds / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    const seconds = diffInSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
};

const getLastRevisionId = (revisions) => (
    revisions.length > 0 ? revisions[revisions.length - 1].id : null
);

const getStateMutators = (stateData) => {
    const updatedStateData = { ...stateData };

    const buildItemExists = (state, build) => (
        updatedStateData[state].some((item) => item.id === build.id)
    );

    const addOperation = (state, build) => {
        if (buildItemExists(state, build)) {
            return updatedStateData;
        }

        updatedStateData[state].push(build);
        return updatedStateData;
    }

    const removeOperation = (state, build) => {
        updatedStateData[state] = updatedStateData[state].filter(
            (item) => item.id !== build.id
        );
        return updatedStateData;
    }

    return [addOperation, removeOperation];
}

const RunningOperationItem = ({ item }) => {
    const [elapsedTime, setElapsedTime] = useState(null);

    useEffect(() => {
        const updateElapsedTime = () => {
            setElapsedTime(calculateDuration(item.start_time));
        };

        updateElapsedTime();
        const intervalId = setInterval(updateElapsedTime, 1000);

        return () => clearInterval(intervalId);
    }, [item.start_time]);

    return (
        <div>
            {elapsedTime ? `Elapsed Time: ${elapsedTime}` : "Calculating..."}
        </div>
    );
};

const CrashedOperationItem = ({ item }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <div>
            <p>Duration: {duration}</p>
            {item.errors && item.errors.length > 0 && (
                <ul>
                    {item.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const FailedOperationItem = ({ item }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <div>
            <p>Duration: {duration}</p>
            <div>
                <h5>Logs:</h5>
                <p><strong>STDOUT:</strong> {item.logs?.stdout || "No stdout available"}</p>
                <p><strong>STDERR:</strong> {item.logs?.stderr || "No stderr available"}</p>
            </div>
        </div>
    );
};

const SuccessfulOperationItem = ({ item }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <li>
            <p>Duration: {duration}</p>
            <div>
                <h5>Logs:</h5>
                <p><strong>STDOUT:</strong> {item.logs?.stdout || "No stdout available"}</p>
                <p><strong>STDERR:</strong> {item.logs?.stderr || "No stderr available"}</p>
            </div>
        </li>
    );
};

const OperationItem = ({ item, status }) => {
    if (status === "running") {
        return <RunningOperationItem item={item} />;
    } else if (status === "crashed") {
        return <CrashedOperationItem item={item} />;
    } else if (status === "failed") {
        return <FailedOperationItem item={item} />;
    } else if (status === "successful") {
        return <SuccessfulOperationItem item={item} />;
    }
    return <li>Unknown operation status</li>;
};


const OperationStateSection = ({ status, items }) => (
    <div className="p-4 border rounded-md">
        <h4>{status.charAt(0).toUpperCase() + status.slice(1)}</h4>
        <div>
            {items.map((item, index) => (
                <OperationItem key={index} item={item} status={status} />
            ))}
        </div>
    </div>
);

const PreviewComponent = ({ message }) => {
    const [lastOperationSuite, setLastOperationSuite] = useState(null);
    const [activeRevisionId, setActiveRevisionId] = useState(
        message.active_revision ? message.active_revision : getLastRevisionId(message.revisions)
    );
    const [stateData, setStateData] = useState(null);
    const [isBuildDisabled, setIsBuildDisabled] = useState(true);

    useEffect(() => {
        setIsBuildDisabled(true);

        const fetchLastSuiteForActiveRevision = async () => {
            let activeRevision = message.revisions.find(
                (revision) => revision.id === activeRevisionId
            );

            if (activeRevision && activeRevision.operation_suites.length > 0) {
                const lastSuiteUrl = activeRevision.operation_suites[activeRevision.operation_suites.length - 1];
                if (lastSuiteUrl) {
                    const result = await fetchDataFromUrl(lastSuiteUrl);
                    setLastOperationSuite(result);
                    
                    if (result?.builds) {
                        const fetchedStates = await fetchStatesData(result.builds);
                        console.log("fetchedStates:", fetchedStates, "result", result)
                        setStateData(fetchedStates);

                        const hasRunningOperations = fetchedStates.running?.length > 0;
                        setIsBuildDisabled(hasRunningOperations);
                    }
                }
            } else {
                setLastOperationSuite(null);
                setStateData(null);
                console.log("setIsBuildDisabled", activeRevisionId, activeRevision, !Boolean(activeRevision))
                setIsBuildDisabled(!Boolean(activeRevision));
            }
        };

        fetchLastSuiteForActiveRevision();
    }, [activeRevisionId, message.revisions]);

    useEffect(() => {
        const handleWebSocketMessage = getWebsocketListener(activeRevisionId, setStateData, setIsBuildDisabled);
        const socket = new WebSocket("ws://localhost:9000");
        socket.addEventListener("open", (event) => {
            socket.send(0);
        });

        socket.addEventListener("message", handleWebSocketMessage);
    
        return () => {
            socket.removeEventListener("message", handleWebSocketMessage);
            socket.close();
        };
    }, [activeRevisionId]);

    async function handleBuildClick() {
        setIsBuildDisabled(true);
        await launchBuild(message.id, activeRevisionId);
    }

    return (
        <div className="preview-component">
            <label htmlFor="revisions-select">Revisions</label>
            <select
                id="revisions-select"
                value={activeRevisionId || ""}
                onChange={(e) => setActiveRevisionId(e.target.value)}
            >
                {message.revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                        {revision.created}
                    </option>
                ))}
            </select>
            <Button
                disabled={isBuildDisabled}
                onClick={handleBuildClick}
            >
                Build
            </Button>
            <div className="operation-suite">
                {stateData ? (
                    Object.entries(stateData).map(([status, items]) => (
                        <OperationStateSection key={status} status={status} items={items} />
                    ))
                ) : lastOperationSuite ? (
                    <p>Loading operation states...</p>
                ) : (
                    <p>No operation suite available for the selected revision.</p>
                )}
            </div>
        </div>
    );
};

function getWebsocketListener(activeRevisionId, setStateData, setIsBuildDisabled) {
    return (event) => {
        try {
            const { event_type, data } = JSON.parse(event.data);

            if (data.revision_id !== activeRevisionId) return;

            setStateData((prevState) => {
                if (!prevState) return prevState;

                const [addOperation, removeOperation] = getStateMutators(prevState);
            
                let updatedStateData
                if (event_type === "build_started") {
                    updatedStateData = addOperation("running", data.build);
                } else if (event_type === "build_finished") {
                    removeOperation("running", data.build);
                    updatedStateData = addOperation(data.build.state, data.build);

                    if (updatedStateData.running.length === 0) {
                        setIsBuildDisabled(false);
                    }
                }

                return updatedStateData;
            });
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };
}


export default PreviewComponent;