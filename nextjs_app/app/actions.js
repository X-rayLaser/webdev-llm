"use server"
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


function removeBlankField(formData, field) {
    const value = formData.get(field);

    if (typeof value === "string" && !value.trim()) {
        formData.delete(field);
    }
}


async function sendData({ url, method="POST", prevState, formData, serverErrorMessage="Something went wrong" }) {
    let message = 'Failed to Create server entry.';
    
    console.log('about to post!', formData)

    try {
        let response = await fetch(url, {
            method,
            body: formData,
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            let errors = await response.json();
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
    } catch (error) {
        return {
            message: error.message || serverErrorMessage,
            errors: error?.errors
        };
    }
}


class ActionSet {
    constructor({ listUrl, pathToRevalidate, excludeBlanks=[], errorMessages, itemName="entry" }) {
        this.listUrl = listUrl;
        this.pathToRevalidate = pathToRevalidate
        this.excludeBlanks = excludeBlanks || [];

        const template = (verb) => `Failed to ${verb} ${itemName}`;
        this.errorMessages = errorMessages || {
            createError: template("create"),
            updateError: template("update"),
            destroyError: template("destroy"),
        };
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
            method: "PUT",
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
                console.error("NOT OK ON DELETION:", response.status, response.json());
                return { message };
            }
        } catch (error) {
            return { message };
        }
    
        revalidatePath(this.pathToRevalidate);
    }

    async mutateData({ url, method, prevState, formData, errorMsg }) {
        for (let field of this.excludeBlanks) {
            removeBlankField(formData, field);
        }

        const errorResult = await sendData({
            url,
            method,
            prevState,
            formData,
            serverErrorMessage: errorMsg
        });

        if (errorResult) {
            return errorResult;
        }

        revalidatePath(this.pathToRevalidate);
    }

    getActionFunctions() {
        const self = this;
        return [self.create.bind(this), self.update.bind(this), self.destroy.bind(this)];
    }
}

const serverActionSet = new ActionSet({
    listUrl: "http://django:8000/api/servers/",
    pathToRevalidate: "/configuration",
    excludeBlanks: ["description", "configuration"],
    itemName: "server"
});

const presetActionSet = new ActionSet({
    listUrl: "http://django:8000/api/presets/",
    pathToRevalidate: "/configuration",
    excludeBlanks: ["extra_params"],
    itemName: "preset"
});

const configActionSet = new ActionSet({
    listUrl: "http://django:8000/api/configurations/",
    pathToRevalidate: "/configuration",
    excludeBlanks: ["extra_params"],
    itemName: "configuration"
});

const [createServerEntry, updateServerEntry, deleteServerEntry] = serverActionSet.getActionFunctions();
const [createPresetEntry, updatePresetEntry, deletePresetEntry] = presetActionSet.getActionFunctions();
const [createConfigEntry, updateConfigEntry, deleteConfigEntry] = configActionSet.getActionFunctions();

export {
    createServerEntry, updateServerEntry, deleteServerEntry,
    createPresetEntry, updatePresetEntry, deletePresetEntry,
    createConfigEntry, updateConfigEntry, deleteConfigEntry
 };
