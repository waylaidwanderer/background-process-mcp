import portfinder from 'portfinder';

import WebSocketServer from './core/WebSocketServer.js';

const DEFAULT_PORT = 31337;

async function main(): Promise<void> {
    try {
        const port = await portfinder.getPortPromise({
            port: DEFAULT_PORT,
        });

        const server = new WebSocketServer(port);

        const handshake = {
            status: 'listening',
            port,
            pid: process.pid,
            server, // Keep a reference to the server to prevent garbage collection
        };
        process.stdout.write(`${JSON.stringify(handshake)}\n`);
    } catch (err) {
        const error = {
            status: 'error',
            message: (err as Error).message,
        };
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(error));
        throw new Error('Server failed to start.');
    }
}

main();
