import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ServerMessage, ServerMessageSchema } from './types/index.js';
import minimist from 'minimist';
import { spawn, ChildProcess } from 'child_process';
import treeKill from 'tree-kill';
import path from 'path';
import { fileURLToPath } from 'url';

// This ensures we can find the cli.js file regardless of where the command is run from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, 'cli.js');

class CoreServiceClient {
  private ws: WebSocket;
  private pendingRequests = new Map<string, (response: ServerMessage) => void>();
  private connectionPromise: Promise<void>;
  private ownedServer: ChildProcess | null = null;

  constructor(serverUrl: string, ownedServer: ChildProcess | null = null) {
    this.ws = new WebSocket(serverUrl);
    this.ownedServer = ownedServer;
    this.connectionPromise = new Promise((resolve, reject) => {
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
    });
    this.setupHandlers();
  }

  public async waitUntilConnected() {
    return this.connectionPromise;
  }

  private setupHandlers() {
    this.ws.on('close', () => {}); // Operate silently
    this.ws.on('message', (data) => {
      try {
        const message = ServerMessageSchema.parse(JSON.parse(data.toString()));
        // Any message with a requestId that we are waiting for is a response.
        if ('requestId' in message && message.requestId && this.pendingRequests.has(message.requestId)) {
          const callback = this.pendingRequests.get(message.requestId);
          if (callback) {
            callback(message);
            this.pendingRequests.delete(message.requestId);
          }
        }
      } catch (error) {
        // If we can't parse a message, it's a real error.
        console.error('MCP client failed to parse message:', error);
      }
    });
  }

  public async sendRequest(message: ClientMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Not connected to Core Service.'));
      }
      this.pendingRequests.set(message.requestId, (response) => {
        if ('success' in response && !response.success) {
          reject(new Error(response.error || 'Request failed'));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => {
        if (this.pendingRequests.has(message.requestId)) {
          this.pendingRequests.delete(message.requestId);
          reject(new Error('Request timed out.'));
        }
      }, 5000);
      this.ws.send(JSON.stringify(message));
    });
  }

  public killOwnedServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ownedServer && this.ownedServer.pid) {
        treeKill(this.ownedServer.pid, 'SIGKILL', () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

async function getOrCreateClient(): Promise<CoreServiceClient> {
  const args = minimist(process.argv.slice(2));
  
  if (args.port) {
    const url = `ws://localhost:${args.port}`;
    return new CoreServiceClient(url);
  }

  const serverProcess = spawn(process.execPath, [cliPath, 'server'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const portPromise = new Promise<number>((resolve, reject) => {
    serverProcess.stdout.once('data', (data) => {
      try {
        const handshake = JSON.parse(data.toString());
        if (handshake.status === 'listening') {
          resolve(handshake.port);
        } else {
          reject(new Error('Server sent unexpected handshake.'));
        }
      } catch (e) {
        reject(new Error('Failed to parse server handshake.'));
      }
    });
    serverProcess.stderr.on('data', (data) => {
        // Forward server errors to our own stderr
        console.error(data.toString().trim());
    });
    setTimeout(() => reject(new Error('Server launch timed out.')), 5000);
  });

  const port = await portPromise;
  const url = `ws://localhost:${port}`;
  return new CoreServiceClient(url, serverProcess);
}

async function main() {
  const client = await getOrCreateClient();
  await client.waitUntilConnected();

  const mcpServer = new FastMCP({
    name: '@waylaidwanderer/bg-mcp',
    version: '1.0.0',
  });

  mcpServer.addTool({
    name: 'start_process',
    description: 'Starts a new process in the background.',
    parameters: z.object({ command: z.string() }),
    execute: async ({ command }) => {
      const result = await client.sendRequest({ action: 'client.start_process', requestId: uuidv4(), command });
      return `Process started with ID: ${result.data.id}`;
    },
  });
  mcpServer.addTool({
    name: 'stop_process',
    description: 'Stops a running process.',
    parameters: z.object({ processId: z.string().uuid() }),
    execute: async ({ processId }) => {
      await client.sendRequest({ action: 'client.stop_process', requestId: uuidv4(), processId });
      return `Stop signal sent to process ${processId}.`;
    },
  });
  mcpServer.addTool({
    name: 'clear_process',
    description: 'Clears a stopped process from the list.',
    parameters: z.object({ processId: z.string().uuid() }),
    execute: async ({ processId }) => {
      await client.sendRequest({ action: 'client.clear_process', requestId: uuidv4(), processId });
      return `Process ${processId} cleared.`;
    },
  });
  mcpServer.addTool({
    name: 'get_process_output',
    description: 'Gets the recent output for a process. Can specify `head` for the first N lines or `tail` for the last N lines.',
    parameters: z.object({
      processId: z.string().uuid(),
      head: z.number().optional(),
      tail: z.number().optional(),
    }).refine(data => !(data.head && data.tail), {
      message: "Cannot specify both 'head' and 'tail'. Please choose one.",
    }),
    execute: async ({ processId, head, tail }) => {
      const result = await client.sendRequest({
        action: 'client.request_output',
        requestId: uuidv4(),
        processId,
        head,
        tail,
      });
      return result.output.join('\n');
    },
  });

  mcpServer.addTool({
    name: 'get_server_status',
    description: 'Gets the current status of the Core Service.',
    parameters: z.object({}),
    execute: async () => {
      const result = await client.sendRequest({
        action: 'client.request_status',
        requestId: uuidv4(),
      });
      // The raw result is the full server message, we just want the data part.
      const { action, requestId, ...status } = result;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  });

  mcpServer.addTool({
    name: 'list_processes',
    description: 'Gets a list of all processes being managed by the Core Service.',
    parameters: z.object({}),
    execute: async () => {
      const result = await client.sendRequest({
        action: 'client.list_processes',
        requestId: uuidv4(),
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.processes, null, 2),
          },
        ],
      };
    },
  });

  const shutdown = async () => {
    await client.killOwnedServer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  mcpServer.start({ transportType: 'stdio' });
}

main();
