"use server"
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


function removeBlankField(formData, field) {
    if (!formData.get(field).trim()) {
        formData.delete(field);
    }
}


export async function createServerEntry(prevState, formData) {
    let message = 'Failed to Create server entry.';

    removeBlankField(formData, "description");
    removeBlankField(formData, "configuration");
    
    console.log('about to post!', formData)
    try {
        let response = await fetch("http://django:8000/api/servers/", {
            method: "POST",
            body: formData,
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            let errors = await response.json();
            console.log("errors", errors, formData)
            message = "Some fields contain incorrect data. Please try again.";

            return {
                message,
                errors
            };
        }

    } catch (error) {
        console.error("error:", error)
        return {
            message
        };
    }

    revalidatePath("/configuration");
}

export async function updateServerEntry(prevState, id, formData) {
    
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