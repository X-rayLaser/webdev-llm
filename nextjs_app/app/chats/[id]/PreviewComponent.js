import React, { useEffect, useState } from 'react';
import { launchBuild } from '@/app/actions';
import { Button } from '@/app/components/buttons';
import { fetchDataFromUrl, fetchStatesData } from '@/app/data';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
    faSpinner, faHammer, faExclamation, faFaceFrownOpen, faFaceSmile
} from '@fortawesome/free-solid-svg-icons';
import Link from "next/link";

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

    const clock = elapsedTime || "";
    return (
        <div className="flex justify-between">
            <div>
                <span className="mr-2">
                    <FontAwesomeIcon icon={faHammer} />
                </span>
                <span className="mr-2">Building...</span>
                <FontAwesomeIcon icon={faSpinner} spin />
            </div>
            <div className="grow-0">{clock}</div>
        </div>
    );
};


const DurationHeader = ({ titlePrefix, duration, icon }) => {
    return (
        <div className="font-semibold mb-2">
            <span className="mr-2">{titlePrefix} {duration}</span>
            <FontAwesomeIcon icon={icon} />
        </div>
    );
}


const CrashedOperationItem = ({ item }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <div className="p-2 bg-red-50 rounded-lg">
            <DurationHeader titlePrefix="Crashed after" duration={duration} icon={faFaceFrownOpen} />

            {item.errors && item.errors.length > 0 && (
                
                <ul className="text-red-800 flex flex-col gap-2">
                    {item.errors.map((error, index) => (
                        <li key={index}>
                            <FontAwesomeIcon icon={faExclamation} />
                            <span className="ml-2">{error}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const LogView = ({ title, log }) => {
    return (
        <div>
            <h5>
                <strong>{title}</strong>
            </h5>
            <div className="whitespace-pre-wrap">
                {log}
            </div>
        </div>
    );
}

const OperationItemWithLogs = ({ item, prefixTitle, titleIcon, beforeLogs, afterLogs }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <div>
            <DurationHeader titlePrefix={prefixTitle} duration={duration} icon={titleIcon} />
            {beforeLogs && <div className="mb-2">{beforeLogs}</div>}

            <div className="flex flex-col gap-2">
                {item.logs?.stdout && <LogView title="STDOUT" log={item.logs.stdout} />}
                {item.logs?.stderr && <LogView title="STDERR" log={item.logs.stderr} />}
            </div>

            {afterLogs && <div className="mt-2">{afterLogs}</div>}
        </div>
    );
}

const FailedOperationItem = ({ item }) => {
    return (
        <div className="p-2 bg-gray-100 rounded-md">
            <OperationItemWithLogs
                item={item}
                prefixTitle="Failed after running for"
                titleIcon={faFaceFrownOpen}
            />
        </div>
    );
};

const SuccessfulOperationItem = ({ item }) => {
    const beforeLogs = item.url ? (
        <div>
            App URL: <Link className="font-bold" href={item.url}>{item.url}</Link>
        </div>
    ) : null;
    return (
        <div className="p-2 bg-green-200 rounded-md">
            <OperationItemWithLogs 
                item={item}
                prefixTitle="Succeeded after running for"
                titleIcon={faFaceSmile}
                beforeLogs={beforeLogs}
            />
        </div>
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


const OperationStateSection = ({ status, items }) => {
    const children = (
        <div>
            <h4 className="mb-2 font-bold">{status.charAt(0).toUpperCase() + status.slice(1)} builds</h4>
            <div className="flex flex-col gap-2">
                {items.map((item, index) => (
                    <OperationItem key={index} item={item} status={status} />
                ))}
            </div>
        </div>
    );

    const borderColors = {
        running: "border-blue-400",
        crashed: "border-red-400",
        failed: "border-gray-400",
        successful: "border-green-400",
        
    };

    let extraClasses = borderColors[status] || "";

    return (
        <div className={`p-4 border ${extraClasses} rounded-md`}>
            {children}
        </div>
    );
};


const SitePreviewBox = ({ url }) => {
    return (
        <div>
            <h4>Preview</h4>
            <iframe src={url} title="React component preview" />
        </div>
    );
}

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

    const successful = stateData?.successful || [];
    const successfulBuild = successful.length > 0 ? successful[successful.length - 1] : null;
    const hasRunningOperations = stateData ? stateData.running?.length > 0 : false;

    const sections = (stateData && Object.entries(stateData)) || [];
    const nonEmptySections = sections.filter(([status, items]) => items && items.length > 0);
    
    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-center">
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
            </div>
            {!hasRunningOperations && successfulBuild && successfulBuild.url && (
                <div>
                    <SitePreviewBox url={successfulBuild.url} />
                </div>
            )}
            <div className="operation-suite">
                {stateData ? (
                    nonEmptySections.map(([status, items]) => (
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