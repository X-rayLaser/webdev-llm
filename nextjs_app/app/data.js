"use server"

export const fetchDataFromUrl = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return null;
    }
};

export const fetchStatesData = async (states) => {
    const result = {};
    for (const [status, urls] of Object.entries(states)) {
        result[status] = await Promise.all(
            urls.map(async (url) => {
                try {
                    return await fetchDataFromUrl(url);
                } catch {
                    return null; // Handle individual fetch failures
                }
            })
        );
    }
    return result;
};


export const fetchRevisions = async (chatId) => {
    const url = `http://django:8000/api/chats/${chatId}/revisions/`;
    return fetchDataFromUrl(url)
}


export const fetchServers = async () => {
    return await fetchDataFromUrl("http://django:8000/api/servers/");
}


export const fetchMessage = async (id) => {
    let data;
    try {
        const response = await fetch(`http://django:8000/api/multimedia-messages/${id}/`);
        data = await response.json();
    } catch (e) {
        console.error("Failed to fetch message:", e);
        data = null;
    }
    return data;
}