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


function fixUrlHost(url, newHost) {
    //replaces part of URL after scheme://
    return url.replace("django:8000", newHost);
}

function getHostOrLocalhost(window) {
    return (window && window.location.host) || "localhost";
}

function getHostNameOrLocalhost(window) {
    return (window && window.location.hostname) || "localhost";
}

function renderMarkdown(text) {
    const md = markdownit({
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    let value = hljs.highlight(str, { language: lang }).value;

                    return `<pre><code class="hljs">${value}</code></pre>`;
                } catch (__) { }
            }

            return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
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


class WebSocketManager {
    constructor(hostName, messageListener) {
        this.hostName = hostName;
        this.messageListener = messageListener
        this.listeners = [];
        this.socket = null;
    }

    connect() {
        // try connecting via secure protocal when failing to connect via insecure one
        // allows to work against HTTP and HTTPS server
        const insecureWsUrl = `ws://${this.hostName}/ws_chat/`;
        const secureWsUrl = `wss://${this.hostName}/ws_chat/`;
        try {
            this.socket = new WebSocket(insecureWsUrl);
        } catch (err) {
            this.socket = new WebSocket(secureWsUrl);
        }

        const handleWebSocketOpen = (event) => {
            this.subscribe("message", this.messageListener)
            this.socket.send(0);
        }

        const handleWebSocketError = (event) => {
            if (event.target.url === insecureWsUrl) {
                this.close();
                this.socket = new WebSocket(secureWsUrl);
                this.subscribe("open", handleWebSocketOpen);
            }
        }

        this.subscribe("open", handleWebSocketOpen);
        this.subscribe("error", handleWebSocketError);
    
        return () => {
            this.close();
        };
    }

    subscribe(event, handler) {
        if (this.socket) {
            this.socket.addEventListener(event, handler);
            this.listeners.push({ event, handler });
        }
    }

    close() {
        const socket = this.socket;
        if (socket) {
            socket.close();
            this.listeners.forEach(({ event, handler }) => {
                socket.removeEventListener(event, handler);
            });
            this.listeners = [];
        }
    }
}


export {
    fetchChats,
    fixUrlHost,
    getHostOrLocalhost,
    getHostNameOrLocalhost,
    renderMarkdown,
    getRandomInt,
    capitalize,
    WebSocketManager
}
