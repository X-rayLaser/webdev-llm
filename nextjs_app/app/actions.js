"use server"
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


function removeBlankField(formData, field) {
    const value = formData.get(field);

    if (typeof value === "string" && !value.trim()) {
        formData.delete(field);
    }
}

async function sendForm(url, method="POST", formData) {
    let message = 'Unknown error';
    
    let response = await fetch(url, {
        method,
        body: formData,
        headers: {
            "Accept": "application/json"
        }
    });


    let responseData;
    const responseClone = response.clone();
    try {
        responseData = await response.json();
    } catch (error) {
        responseData = await responseClone.text();
        console.error("API error:", responseData);
        throw {
            message: "Unexpected server error",
            errors: []
        };
    }

    if (!response.ok) {
        let errors = responseData;
        console.log("errors", errors, formData)
        if (response.status == 400) {
            message = "Some fields contain incorrect data. Please try again.";
        } else if (response.status == 405) {
            message = errors.detail;
        }

        throw {
            message,
            errors
        };
    }

    return prepareResultMessage(true, responseData);
}


function prepareResultMessage(success, responseData) {
    return {
        success,
        responseData
    };
}


async function sendData({ url, method="POST", prevState, formData, serverErrorMessage="Something went wrong" }) {
    console.log('about to post!', formData)

    try {
        return await sendForm(url, method, formData);
    } catch (error) {
        return prepareResultMessage(false, {
            message: error.message || serverErrorMessage,
            errors: error?.errors
        });
    }
}


class ActionSet {
    constructor({ listUrl, pathToRevalidate, excludeBlanks=[], errorMessages, itemName="entry", updateMethod="PUT" }) {
        this.listUrl = listUrl;
        this.pathToRevalidate = pathToRevalidate
        this.excludeBlanks = excludeBlanks || [];

        const template = (verb) => `Failed to ${verb} ${itemName}`;
        this.errorMessages = errorMessages || {
            createError: template("create"),
            updateError: template("update"),
            destroyError: template("destroy"),
        };

        this.updateMethod = updateMethod;
    }

    async create(prevState, formData) {
        return await this.mutateData({
            url: this.listUrl,
            prevState,
            formData,
            errorMsg: this.errorMessages.createError
        });
    }

    async update(id, prevState, formData) {
        const url = `${this.listUrl}${id}/`;
        return await this.mutateData({
            url,
            method: this.updateMethod,
            prevState,
            formData,
            errorMsg: this.errorMessages.updateError
        });
    }

    async destroy(id) {
        let message = this.errorMessages.destroyError;

        // todo: return 404 response if not found
        try {
            const url = `${this.listUrl}${id}/`;
            const response = await fetch(url, { method: "delete" });
    
            if (!response.ok) {
                console.error("NOT OK ON DELETION:", response.status, response.status === 404, response.json());
                if (response.status == 404) {
                    return prepareResultMessage(false, `Item to be deleted not found: ${id}`);
                }
                throw { message };
            }
        } catch (error) {
            return prepareResultMessage(false, message);
        }
    
        if (this.pathToRevalidate) {
            revalidatePath(this.pathToRevalidate);
        }
        return { success: true };
    }

    async mutateData({ url, method, prevState, formData, errorMsg }) {
        for (let field of this.excludeBlanks) {
            removeBlankField(formData, field);
        }

        const result = await sendData({
            url,
            method,
            prevState,
            formData,
            serverErrorMessage: errorMsg
        });

        if (result.success && this.pathToRevalidate) {
            revalidatePath(this.pathToRevalidate);
        }

        return result;
    }

    getActionFunctions() {
        const self = this;
        return [self.create.bind(this), self.update.bind(this), self.destroy.bind(this)];
    }
}

const baseApiUrl = "http://django:8000/api";

const serverActionSet = new ActionSet({
    listUrl: `${baseApiUrl}/servers/`,
    pathToRevalidate: "/configuration",
    excludeBlanks: ["description", "configuration"],
    itemName: "server"
});

const presetActionSet = new ActionSet({
    listUrl: `${baseApiUrl}/presets/`,
    pathToRevalidate: "/configuration",
    excludeBlanks: ["extra_params"],
    itemName: "preset"
});

const configActionSet = new ActionSet({
    listUrl: `${baseApiUrl}/configs/`,
    pathToRevalidate: "/configuration",
    excludeBlanks: ["extra_params"],
    itemName: "configuration"
});

const chatActionSet = new ActionSet({
    listUrl: `${baseApiUrl}/chats/start-new-chat/`,
    pathToRevalidate: "/chats",
    itemName: "chat"
});


const [createServerEntry, updateServerEntry, deleteServerEntry] = serverActionSet.getActionFunctions();
const [createPresetEntry, updatePresetEntry, deletePresetEntry] = presetActionSet.getActionFunctions();
const [createConfigEntry, updateConfigEntry, deleteConfigEntry] = configActionSet.getActionFunctions();


async function fetchJson(url, method, data) {

    let response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(data)
    });

    return response;
}


async function startNewChat(prevState, formData) {
    const prompt = formData.get("prompt");
    if (!prompt) {
        return prepareResultMessage(false, {
            errors: {
                prompt: ["This field is required"]
            },
            message: "Some fields are incorrect or missing. Please try again"
        });
    }

    formData.append("name", prompt.substring(0, 255));
    const result = await chatActionSet.create(prevState, formData);

    if (result.success) {
        const id = result.responseData["id"];
        redirect(`/chats/${id}`);
    }

    if (!result.success) {
        const errors = result.responseData.errors;
        if (errors.hasOwnProperty("name")) {
            const { name, ...rest} = errors;
            return prepareResultMessage(false, {
                errors: { prompt: name, ...rest },
                message: result.responseData.message
            });
        }
    }

    return result;
}

async function deleteChat(id) {
    const deletionActionSet = new ActionSet({
        listUrl: "http://django:8000/api/chats/",
        pathToRevalidate: "/chats",
        itemName: "chat"
    });
    const result = await deletionActionSet.destroy(id);
    redirect(`/chats/`);
    return result;
}

async function createMixedModality() {
    const url = `${baseApiUrl}/modalities/`;
    try {
        const response = await fetchJson(url, "POST", { modality_type: "mixture"});

        if (!response.ok) {
            return prepareResultMessage(false, {
                message: "Failed to create a mixed modality",
                errors: []
            })
        }

        const responseData = await response.json();
    
        return prepareResultMessage(true, responseData);
    } catch (error) {
        console.log("Error");
        return prepareResultMessage(false, {
            message: "Failed to create a mixed modality",
            errors: []
        })
    }
}

const textModalityActionSet = new ActionSet({
    listUrl: `${baseApiUrl}/modalities/`,
    itemName: "text modality",
    updateMethod: "PATCH"
});


async function createTextModality(parentId, prevState, formData) {
    formData.append("parent", parentId);
    formData.append("modality_type", "text");
    const result = await textModalityActionSet.create(prevState, formData);

    return result;
}

const [_ignored1, updateTextModality, deleteTextModality] = textModalityActionSet.getActionFunctions();


export {
    createServerEntry, updateServerEntry, deleteServerEntry,
    createPresetEntry, updatePresetEntry, deletePresetEntry,
    createConfigEntry, updateConfigEntry, deleteConfigEntry,
    startNewChat, deleteChat,
    createMixedModality,
    createTextModality, updateTextModality, deleteTextModality
 };
