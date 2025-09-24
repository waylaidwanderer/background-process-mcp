import { WebSocketServer } from './core/WebSocketServer.js';
import portfinder from 'portfinder';

const DEFAULT_PORT = 31337;

async function main() {
  try {
    const port = await portfinder.getPortPromise({
      port: DEFAULT_PORT,
    });

    new WebSocketServer(port);

    const handshake = {
      status: 'listening',
      port: port,
      pid: process.pid,
    };
    process.stdout.write(JSON.stringify(handshake) + '\n');

  } catch (err) {
    console.error(JSON.stringify({ status: 'error', message: (err as Error).message }));
    process.exit(1);
  }
}

main();
