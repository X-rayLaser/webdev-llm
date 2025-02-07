"use client"
import React, { useEffect, useState } from 'react';
import { launchBuild } from '@/app/actions';
import { getHostNameOrLocalhost } from '@/app/utils';
import { Button } from '@/app/components/buttons';
import { fetchDataFromUrl, fetchRevisions, fetchStatesData } from '@/app/data';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
    faSpinner, faHammer, faExclamation, faFaceFrownOpen, faFaceSmile, faEye
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
            <FontAwesomeIcon icon={icon} className="fa-regular" />
        </div>
    );
}


const CrashedOperationItem = ({ item }) => {
    const duration = calculateDuration(item.start_time, item.end_time);

    return (
        <div className="py-2">
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
        <div>
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
            App URL: <Link className="font-bold text-blue-400" href={`${item.url}`} target='blank'>
                Click to open it in a new tab
            </Link>
        </div>
    ) : null;
    return (
        <div>
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
    const borderColors = {
        running: "border-blue-400",
        crashed: "border-red-400",
        failed: "border-gray-400",
        successful: "border-green-400"
    };

    const extraClasses = borderColors[status] || "";

    const children = (
        <div className={`border ${extraClasses} rounded-md`}>
            <h4 className="font-bold rounded-t-md border-b p-4">{status.charAt(0).toUpperCase() + status.slice(1)} builds</h4>
            <div className="flex flex-col gap-0">
                {items.map((item, index) => (
                    <div key={index} className="border-b first:border-b last:border-none p-4">
                        <OperationItem item={item} status={status} />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            {children}
        </div>
    );
};


const SitePreviewBox = ({ url }) => {
    return (
        <div className="border rounded-sm shadow-lg">
            <h4 className="p-2 bg-gray-700 text-gray-100 rounded-t-sm">
                React Component Preview <span className="ml-2"><FontAwesomeIcon icon={faEye} /></span>
            </h4>
            <iframe src={url} title="React component preview" className="w-full h-[700px]" />
        </div>
    );
}

const PreviewComponent = ({ chatId }) => {
    const [lastOperationSuite, setLastOperationSuite] = useState(null);
    const [revisions, setRevisions] = useState([]);
    const [selectedRevisionId, setSelectedRevisionId] = useState(null);
    const [stateData, setStateData] = useState(null);
    const [isBuildDisabled, setIsBuildDisabled] = useState(true);

    const fetchLastSuiteForActiveRevision = async () => {
        let activeRevision = revisions.find(
            (revision) => revision.id == selectedRevisionId
        );

        if (activeRevision && activeRevision.operation_suites.length > 0) {
            const lastSuiteUrl = activeRevision.operation_suites[activeRevision.operation_suites.length - 1];

            if (lastSuiteUrl) {
                const result = await fetchDataFromUrl(lastSuiteUrl);
                setLastOperationSuite(result);
                
                if (result?.builds) {
                    const fetchedStates = await fetchStatesData(result.builds);
                    setStateData(fetchedStates);

                    const hasRunningOperations = fetchedStates.running?.length > 0;
                    setIsBuildDisabled(hasRunningOperations);
                }
            }
        } else {
            setLastOperationSuite(null);
            setStateData(null);
            setIsBuildDisabled(!Boolean(activeRevision));
        }
    };

    const initOnMount = () => {
        fetchRevisions(chatId).then(revs => {
            setRevisions(revs);
            const activeId = getLastRevisionId(revs);
            setSelectedRevisionId(activeId);
        });
    }

    const handleBuildFinished = () => {
        fetchRevisions(chatId).then(revs => {
            setRevisions(revs);
        });
    }

    useEffect(() => {
        initOnMount();
    }, []);

    useEffect(() => {
        setIsBuildDisabled(true);
        fetchLastSuiteForActiveRevision();
    }, [revisions, selectedRevisionId]);

    useEffect(() => {
        const handleWebSocketMessage = getWebsocketListener(
            selectedRevisionId, setStateData, handleBuildFinished
        );
        const hostName = getHostNameOrLocalhost(window);
        const socket = new WebSocket(`ws://${hostName}:9000`);
        socket.addEventListener("open", (event) => {
            socket.send(0);
        });

        socket.addEventListener("message", handleWebSocketMessage);
    
        return () => {
            socket.removeEventListener("message", handleWebSocketMessage);
            socket.close();
        };
    }, [selectedRevisionId]);

    async function handleSelect(e) {
        const value = parseInt(e.target.value);
        const revs = await fetchRevisions(chatId);
        setRevisions(revs);
        setSelectedRevisionId(value);
    }

    async function handleBuildClick() {
        setIsBuildDisabled(true);
        setStateData(null);
        await launchBuild(selectedRevisionId);
    }

    const successful = stateData?.successful || [];
    const successfulBuild = successful.length > 0 ? successful[successful.length - 1] : null;
    const hasRunningOperations = stateData ? stateData.running?.length > 0 : false;

    const sections = (stateData && Object.entries(stateData)) || [];
    const nonEmptySections = sections.filter(([status, items]) => items && items.length > 0);
    
    const renderedSections = (
        <div className="flex flex-col gap-4">
            {nonEmptySections.map(([status, items]) => (
                <OperationStateSection key={status} status={status} items={items} />
            ))}
        </div>
    );
    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-center">
                <label htmlFor="revisions-select">Revisions</label>
                <select
                    id="revisions-select"
                    value={selectedRevisionId || ""}
                    onChange={handleSelect}
                >
                    {revisions.map((revision) => (
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
                    <div>{renderedSections}</div>
                ) : lastOperationSuite ? (
                    <p>Loading operation states...</p>
                ) : (
                    <p>No builds yet</p>
                )}
            </div>
        </div>
    );
};

function getWebsocketListener(activeRevisionId, setStateData, onBuildFinished) {
    return (event) => {
        try {
            const { event_type, data } = JSON.parse(event.data);

            if (data.revision_id !== activeRevisionId) return;

            if (event_type === "build_finished") {
                onBuildFinished();
                return;
            }

            setStateData((prevState) => {
                if (!prevState) {
                    prevState = {
                        running: [],
                        crashed: [],
                        failed: [],
                        successful: []
                    };
                };

                const [addOperation, removeOperation] = getStateMutators(prevState);
            
                let updatedStateData
                if (event_type === "build_started") {
                    updatedStateData = addOperation("running", data.build);
                } else if (event_type === "build_finished") {
                    removeOperation("running", data.build);
                    updatedStateData = addOperation(data.build.state, data.build);
                }

                return updatedStateData;
            });
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };
}


export default PreviewComponent;