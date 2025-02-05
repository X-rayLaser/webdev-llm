"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { fetchSourceFiles, makeRevision } from "@/app/actions";
import { ConfirmationModal } from "@/app/components/modal";
import { formFactory, makeCreateForm } from "@/app/components/form-factory";
import { DiscardButton, CommitButton } from "@/app/components/buttons";
import { AutoExpandingTextArea } from "@/app/components/common-forms";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt, faUndo, faRedo, faCopy, faPlus } from "@fortawesome/free-solid-svg-icons";


function unstageFile(stagingArea, file_path) {
    return Object.fromEntries(
        Object.entries(stagingArea).filter(([key, value]) => key !== file_path)
    );
}


// Compute committed changes (diff between parentFiles and currentFiles)
const computeCommittedChanges = (parentFiles, currentFiles) => {
    const changes = [];
    const parentMap = {};
    parentFiles.forEach((f) => {
        parentMap[f.file_path] = f;
    });
    currentFiles.forEach((f) => {
        if (parentMap[f.file_path]) {
            // File existed in parent; compare content
            if (parentMap[f.file_path].content !== f.content) {
                changes.push({
                    file_path: f.file_path,
                    status: "edited",
                });
            }
        } else {
            changes.push({
                file_path: f.file_path,
                status: "new",
            });
        }
    });
    // Look for deletions (files in parent not in current)
    parentFiles.forEach((f) => {
        if (!currentFiles.find((cf) => cf.file_path === f.file_path)) {
            changes.push({
                file_path: f.file_path,
                status: "deleted",
            });
        }
    });
    return changes;
};


function generateDiff(oldText = "", newText = "") {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const maxLen = Math.max(oldLines.length, newLines.length);
    const diffLines = [];
    for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i] || "";
        const newLine = newLines[i] || "";
        if (oldLine === newLine) {
            diffLines.push({ type: "unchanged", text: newLine });
        } else {
            if (oldLine) diffLines.push({ type: "removed", text: oldLine });
            if (newLine) diffLines.push({ type: "added", text: newLine });
        }
    }
    return diffLines;
}


function FileBrowser({ files, onSelectFile, onDeleteFile, onAddFile, selectedFilePath }) {
    const [newFileName, setNewFileName] = useState("");

    const isEmptyName = newFileName.trim() === "" ? true : false;

    const handleAdd = () => {
        if (newFileName.trim() !== "") {
            onAddFile(newFileName.trim());
            setNewFileName("");
        }
    };

    return (
        <div className="border p-2 rounded mb-4">
            <h3 className="font-semibold mb-2">Files</h3>
            <ul>
                {files.map((file) => (
                    <li
                        key={file.file_path}
                        className={`flex justify-between items-center px-2 py-1 hover:bg-gray-100 cursor-pointer ${selectedFilePath === file.file_path ? "bg-gray-200" : ""
                            }`}
                        onClick={() => onSelectFile(file)}
                    >
                        <span>{file.file_path}</span>
                        <button
                            className="text-red-500 hover:text-red-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFile(file);
                            }}
                        >
                            <FontAwesomeIcon icon={faTrashAlt} />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="mt-2 flex">
                <input
                    type="text"
                    placeholder="New file name"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="flex-1 border rounded px-1 py-0.5"
                />
                <button
                    onClick={handleAdd}
                    disabled={isEmptyName}
                    className="ml-2 bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>
        </div>
    );
}

function VCSItem({ item, onClick = null }) {
    // todo: refactor this: set onClick to null if item is not edited
    let badgeColor = "";
    if (item.status === "new") badgeColor = "bg-green-200 text-green-800";
    if (item.status === "edited") badgeColor = "bg-blue-200 text-blue-800";
    if (item.status === "deleted") badgeColor = "bg-red-200 text-red-800";
    return (
        <li
            className={`flex justify-between items-center px-2 py-1 hover:bg-gray-100 cursor-pointer ${onClick ? "cursor-pointer" : ""
                }`}
            onClick={() => onClick && onClick(item)}
        >
            <span>{item.file_path}</span>
            <span className={`text-xs font-semibold px-1 py-0.5 rounded ${badgeColor}`}>
                {item.status}
            </span>
        </li>
    );
};


function VCSContainer({
    parentFiles,
    currentFiles,
    stagingChanges,
    onCommittedItemClick,
    onStagedItemClick,
    onDiscard,
    commitAction
}) {
    const committedChanges = computeCommittedChanges(parentFiles, currentFiles);

    // stagingChanges is an object: { [file_path]: { file_path, content, status } }
    const stagingList = Object.values(stagingChanges);

    const fields = [{
        name: "commit_text",
        component: AutoExpandingTextArea,
        id: "commit_text_field_id",
        placeholder: "Optional comment describing the changes made"
      }];
      
      
    function renderFields(formFields, names, errorMessage, submitButton) {
        return (
            <div>
                <div>{formFields.commit_text}</div>

                <div className="mt-2">{errorMessage}</div>

                <div className="mt-2 flex justify-end space-x-2">
                    <DiscardButton onClick={onDiscard} />
                    {submitButton}
                </div>
            </div>
        );
    }

    const sourceFiles = Object.values(stagingChanges).map((change) => {
        // Only include "deleted" flag if file is marked as deleted.
        const { file_path, content, status } = change;
        if (status === "deleted") return { file_path, content, deleted: true };
        return { file_path, content };
    });
    
    const creationAction = commitAction.bind(null, sourceFiles);
    const RevisionForm = formFactory(fields, renderFields, CommitButton, "Commit");
    const CreateRevisionForm = makeCreateForm(RevisionForm, creationAction);

    return (
        <div className="border p-2 rounded">
            <h3 className="font-semibold mb-2">Version Control</h3>
            <div className="mb-4">
                <h4 className="font-medium text-sm mb-1">Committed Changes</h4>
                {committedChanges.length === 0 ? (
                    <div className="text-center text-lg mt-4">No changes between this revision and previous one</div>
                ) : (
                    <ul>
                        {committedChanges.map((item) =>
                            <VCSItem key={item.file_path} item={item} 
                                onClick={item.status === "edited" ? onCommittedItemClick : null} />
                        )}
                    </ul>
                )}
            </div>
            <div>
                <h4 className="font-medium text-sm mb-1">Staging Area</h4>
                {stagingList.length === 0 ? (
                    <div className="text-center text-lg mt-4">Area is empty. No changes to commit.</div>
                ) : (
                    <div>
                        <ul>
                            {stagingList.map((item) => {
                                const clickHandler = (item.status === "new" || item.status === "edited") ? onStagedItemClick : null
                                return <VCSItem key={item.file_path} item={item} onClick={clickHandler} />;
                            })}
                        </ul>
                        <CreateRevisionForm onSuccess={() => null} />
                    </div>
                )}
            </div>
        </div>
    );
}


function FileEditor({ file, onContentChange }) {
    // Basic implementation with toolbar: undo, redo, copy.
    const [content, setContent] = useState(file ? file.content : "");
    const [history, setHistory] = useState([file ? file.content : ""]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const textAreaRef = useRef();

    // Sync editor content when file prop changes
    useEffect(() => {
        const newContent = file ? file.content : "";
        setContent(newContent);
        setHistory([newContent]);
        setHistoryIndex(0);
    }, [file]);

    const handleChange = (e) => {
        const newContent = e.target.value;
        setContent(newContent);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newContent);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onContentChange && onContentChange(newContent);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setContent(history[newIndex]);
            onContentChange && onContentChange(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setContent(history[newIndex]);
            onContentChange && onContentChange(history[newIndex]);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
    };

    const disableUndo = (historyIndex <= 0);
    const disableRedo = (historyIndex >= history.length - 1);

    return (
        <div className="flex flex-col h-full">
            <div className="flex space-x-2 bg-gray-100 p-2 border-b">
                <button onClick={handleUndo} title="Undo"
                    disabled={disableUndo}
                    className="hover:text-blue-500 disabled:opacity-30"
                >
                    <FontAwesomeIcon icon={faUndo} />
                </button>
                <button onClick={handleRedo} title="Redo"
                    disabled={disableRedo}
                    className="hover:text-blue-500 disabled:opacity-30"
                >
                    <FontAwesomeIcon icon={faRedo} />
                </button>
                <button onClick={handleCopy} title="Copy" className="hover:text-blue-500">
                    <FontAwesomeIcon icon={faCopy} />
                </button>
            </div>
            <textarea
                ref={textAreaRef}
                value={content}
                onChange={handleChange}
                className="flex-1 p-2 font-mono text-sm resize-none outline-none"
            />
        </div>
    );
}


function DiffViewer({ oldContent, newContent }) {
    const diffLines = generateDiff(oldContent, newContent);
    return (
        <div className="p-2 font-mono text-sm">
            {diffLines.map((line, index) => {
                let bgClass = "";
                if (line.type === "added") bgClass = "bg-green-100";
                if (line.type === "removed") bgClass = "bg-red-100";
                return (
                    <pre key={index} className={`${bgClass} whitespace-pre-wrap`}>
                        {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                        {line.text}
                    </pre>
                );
            })}
        </div>
    );
}


export default function IDE({ chatId, activeRevision, revisions }) {
    // Selected revision state (dropdown)
    const [selectedRevision, setSelectedRevision] = useState(activeRevision);
    // File trees for current and parent revisions
    const [currentFiles, setCurrentFiles] = useState([]);
    const [parentFiles, setParentFiles] = useState([]);
    // Staging changes: an object mapping file_path => { file_path, content, status }
    const [stagingChanges, setStagingChanges] = useState({});
    // The file selected from the file browser for editing
    const [selectedFile, setSelectedFile] = useState(null);
    // The file (from staging or VCS) to view diff (if any)
    const [diffFile, setDiffFile] = useState(null);
    // Show discard confirmation modal?
    const [showDiscardModal, setShowDiscardModal] = useState(false);

    // Helper: fetch current and parent file trees.
    // todo: why useCallback
    const loadFiles = useCallback(async (revisionId) => {
        try {
            const files = await fetchSourceFiles(revisionId);
            setCurrentFiles(files);
            // Find parent revision: in the revisions array, find the one immediately preceding the current revision.
            const currentIndex = revisions.findIndex((r) => r.id === revisionId);
            if (currentIndex > 0) {
                const parentRevision = revisions[currentIndex - 1];
                const parentFilesData = await fetchSourceFiles(parentRevision.id);
                setParentFiles(parentFilesData);
            } else {
                setParentFiles([]);
            }
            // Clear any file selection and diff view when revision changes.
            setSelectedFile(null);
            setDiffFile(null);
            // Also clear staging area (assuming switching revision resets staging)
            setStagingChanges({});
        } catch (error) {
            console.error("Error fetching source files:", error);
        }
    }, [revisions]);

    // Load files on mount and when selectedRevision changes.
    useEffect(() => {
        loadFiles(selectedRevision.id);
    }, [selectedRevision, loadFiles]);

    const handleRevisionChange = (e) => {
        const revisionId = e.target.value;
        const rev = revisions.find((r) => r.id == revisionId);

        if (rev) {
            setSelectedRevision(rev);
        }
    };

    const handleSelectFile = (file) => {
        // If the file is staged as deleted, do not open.
        if (stagingChanges[file.file_path] && stagingChanges[file.file_path].status === "deleted") {
            return;
        }

        let stagedFile = stagingChanges[file.file_path];
        stagedFile = stagedFile && {...stagedFile};
        setSelectedFile(stagedFile || file);
        setDiffFile(null);
    };

    const handleAddFile = (filePath) => {
        // Add to staging changes as new file.

        if (stagingChanges[filePath] || currentFiles.find(f => f.file_path === filePath)) {
            alert(`File with name "${filePath}" already exists!`);
            return;
        }

        setStagingChanges((prev) => ({
            ...prev,
            [filePath]: { file_path: filePath, content: "", status: "new" },
        }));
    };

    const handleDeleteFile = (file) => {
        setStagingChanges((prev) => {
            const existing = prev[file.file_path];
            // if file to be deleted was created in the browser, unstage it
            if (existing && existing.status === "new") {
                return unstageFile(prev, file.file_path);
            }

            return {
                ...prev,
                [file.file_path]: { file_path: file.file_path, content: file.content, status: "deleted" },
            };
        });
        // Also if the file is currently opened in editor, close it.
        if (selectedFile && selectedFile.file_path === file.file_path) {
            setSelectedFile(null);
        }
    };

    const handleEditorChange = (newContent) => {
        if (!selectedFile) return;
        setStagingChanges((prev) => {
            const existing = prev[selectedFile.file_path];
            const original = currentFiles.find(f => f.file_path === selectedFile.file_path);

            // if a selected file was already edited,
            // but there is no change between original and current content, unstage the file
            if (existing && existing.status === "edited" && original && original.content === newContent) {
                return unstageFile(prev, selectedFile.file_path);
            }

            let newStatus = existing ? existing.status : "edited";

            // If the file was "new", keep it this way".
            if (existing && existing.status === "new") {
                newStatus = "new";
            }
            return {
                ...prev,
                [selectedFile.file_path]: { file_path: selectedFile.file_path, content: newContent, status: newStatus },
            };
        });
    };

    const handleStagedItemClick = (item) => {
        let staged = stagingChanges[item.file_path];

        if (staged && staged.status === "new") {
            setSelectedFile(staged);
            setDiffFile(null);
        } else if (staged && staged.status === "edited") {
            const current = currentFiles.find((f) => f.file_path === item.file_path);
            const oldContent = current ? current.content : "";
            const newContent = staged.content;
            setDiffFile({ file_path: item.file_path, oldContent, newContent });
            setSelectedFile(null);
        }
    };

    const handleCommittedItemClick = (item) => {
        if (item.status === "edited") {
            const old = parentFiles.find((f) => f.file_path === item.file_path);
            const current = currentFiles.find((f) => f.file_path === item.file_path);
            const oldContent = old ? old.content : "";
            const newContent = current ? current.content : "";
            setDiffFile({ file_path: item.file_path, oldContent, newContent });
            setSelectedFile(null);
        }
    }

    const handleDiscardChanges = () => {
        setShowDiscardModal(true);
    };

    const confirmDiscard = () => {
        setStagingChanges({});
        setDiffFile(null);
        setShowDiscardModal(false);
    };

    const cancelDiscard = () => {
        setShowDiscardModal(false);
    };

    const stagedCreated = Object.values(stagingChanges).filter(sf => sf.status === "new");
    const currentRevisionUndeletedFiles = currentFiles.filter(
        f => !(stagingChanges[f.file_path] && stagingChanges[f.file_path].status === "deleted")
    );
    const browserFiles = [...currentRevisionUndeletedFiles, ...stagedCreated];

    const commitAction = makeRevision.bind(null, chatId, selectedRevision.id);

    return (
        <div className="flex flex-col h-full">
            {/* Top: Revision Dropdown */}
            <div className="p-2 border-b flex items-center">
                <label htmlFor="revision-select" className="mr-2 font-medium">
                    Revision:
                </label>
                <select
                    id="revision-select"
                    value={selectedRevision.id}
                    onChange={handleRevisionChange}
                    className="border rounded px-2 py-1"
                >
                    {revisions.map((rev) => (
                        <option key={rev.id} value={rev.id}>
                            {rev.created}
                        </option>
                    ))}
                </select>
            </div>
            {/* Main area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left section: file browser + VCS container */}
                <div className="w-full sm:w-1/3 border-r overflow-auto p-2">
                    <FileBrowser
                        files={browserFiles}
                        onSelectFile={handleSelectFile}
                        onDeleteFile={handleDeleteFile}
                        onAddFile={handleAddFile}
                        selectedFilePath={selectedFile ? selectedFile.file_path : null}
                    />
                    <VCSContainer
                        parentFiles={parentFiles}
                        currentFiles={currentFiles}
                        stagingChanges={stagingChanges}
                        onCommittedItemClick={handleCommittedItemClick}
                        onStagedItemClick={handleStagedItemClick}
                        onDiscard={handleDiscardChanges}
                        commitAction={commitAction}
                    />
                </div>
                {/* Right section: either file editor or diff viewer */}
                <div className="flex-1 overflow-auto p-2">
                    {diffFile ? (
                        <DiffViewer oldContent={diffFile.oldContent} newContent={diffFile.newContent} />
                    ) : selectedFile ? (
                        <FileEditor file={selectedFile} onContentChange={handleEditorChange} />
                    ) : (
                        <div className="text-center text-gray-500 mt-10">Select a file to edit or view diff.</div>
                    )}
                </div>
            </div>
            {/* Discard confirmation modal */}
            <ConfirmationModal
                title="Do you confirm the operation?"
                show={showDiscardModal}
                onYes={confirmDiscard}
                onClose={cancelDiscard}
            >
                <p>Are you sure you want to discard all changes?</p>
            </ConfirmationModal>
        </div>
    );
}
