"use server"
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


function removeBlankField(formData, field) {
    if (!formData.get(field).trim()) {
        formData.delete(field);
    }
}


async function sendData({ url, method="POST", prevState, formData, serverErrorMessage="Something went wrong" }) {
    let message = 'Failed to Create server entry.';

    removeBlankField(formData, "description");
    removeBlankField(formData, "configuration");
    
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


export async function createServerEntry(prevState, formData) {
    const errorResult = await sendData({
        url: "http://django:8000/api/servers/",
        prevState,
        formData,
        serverErrorMessage: 'Failed to create server entry.' 
    });

    if (errorResult) {
        return errorResult;
    }

    revalidatePath("/configuration");
}

export async function updateServerEntry(id, prevState, formData) {
    console.log("update: ", id);
    const errorResult = await sendData({
        url: `http://django:8000/api/servers/${id}/`,
        method: "PUT",
        prevState,
        formData,
        serverErrorMessage: 'Failed to update server entry.' 
    });

    if (errorResult) {
        return errorResult;
    }

    revalidatePath("/configuration");
}

export async function deleteServerEntry(id) {
    console.log('about to delete!')

    let message = 'Failed to delete server entry.';

    // todo: return 404 response if not found
    try {
        const url = `http://django:8000/api/servers/${id}/`;
        const response = await fetch(url, {
            method: "delete"
        });

        if (!response.ok) {
            console.error("NOT OK ON DELETION:", response.status, response.json());
            return { message };
        }
    } catch (error) {
        return { message };
    }

    revalidatePath('/configuration');
}


export async function createPresetEntry() {
    
}