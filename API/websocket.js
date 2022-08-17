const WebSocket = require('isomorphic-ws');
const logger = require("./logger");

const websocket = {
    wss: null,
    init: function (server) {
        logger(
            "info",
            "Trying to init websocket...",
            "websocket",
            null,
            ""
        );

        if (!server === null) {
            logger(
                "websocket_error",
                "server parameter not defined.",
                "error",
                null,
                ""
            );
            return null
        }

        logger(
            "info",
            "Server is valid so still trying to init websocket...",
            "websocket",
            null,
            ""
        );

        const wss = new WebSocket.Server({ server });
        websocket.wss = wss;

        // Broadcast to all clients
        wss.broadcast = function broadcast(data) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && data !== undefined) {
                    client.send(data);
                }
            });
        };

        wss.on('connection', (ws) => {
            ws.on('message', (message) => {
                // Log the received message and send it back to all of the connected clients
                logger(
                    "info",
                    `received in websocket API: ${message} ${typeof(message)}`,
                    "",
                    ""
                );
                wss.broadcast(message);
            });

            // Send a message back immediately upon connnecting
            ws.send('Hello, I am a WebSocket server started via the API...');
        });

        wss.on('close', () => {
            logger(
                "info",
                "Websocket disconnected...",
                "websocket",
                null,
                ""
            );
            websocket.wss = null
        });
    }
}


module.exports = { websocket };
