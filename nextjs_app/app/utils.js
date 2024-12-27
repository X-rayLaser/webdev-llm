import markdownit from 'markdown-it';
import hljs from 'highlight.js' // https://highlightjs.org
import 'highlight.js/styles/github.css';


async function fetchChats(baseUrl, query) {
    let chats = [];
    let totalPages = 1;

    try {
        const extra = query ? `?${query}` : "";
        const response = await fetch(`${baseUrl}${extra}`);
        const data = await response.json();
        chats = data.results;
        // todo: modify API to return totalPages in response
        totalPages = data.num_pages;
        console.log(data.count, totalPages)
    } catch (error) {
        console.error("Failed to fetch chats:", error);
        throw error;
    }

    return [ chats, totalPages ];
}


function renderMarkdown(text) {
    const md = markdownit({
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    let value = hljs.highlight(str, { language: lang }).value;

                    return `<code class="hljs">${value}</code>`;
                } catch (__) { }
            }

            return '<code class="hljs">' + md.utils.escapeHtml(str) + '</code>';
        }
    });
    return md.render(text);
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1).toLowerCase();
}


export {
    fetchChats,
    renderMarkdown,
    getRandomInt,
    capitalize
}
