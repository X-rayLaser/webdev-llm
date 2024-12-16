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

