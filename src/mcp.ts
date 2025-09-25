import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FastMCP } from 'fastmcp';
import minimist from 'minimist';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { z } from 'zod';

import { ServerMessageSchema } from './types/index.js';

import type { ChildProcess } from 'node:child_process';

import type { ClientMessage, ServerMessage } from './types/index.js';

// This ensures we can find the cli.js file regardless of where the command is run from.
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);
const cliPath = join(currentDirname, 'cli.js');

async function getPackageInfo(): Promise<{ name: string; version: string }> {
    const packageJsonPath = join(currentDirname, '..', 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as {
        name: string;
        version: string;
    };
    return { name: packageJson.name, version: packageJson.version };
}

class CoreServiceClient {
    private ws: WebSocket;

    private pendingRequests = new Map<
        string,
        (response: ServerMessage) => void
    >();

    private connectionPromise: Promise<void>;

    private ownedServer: ChildProcess | null = null;

    public constructor(serverUrl: string, ownedServer: ChildProcess | null = null) {
        this.ws = new WebSocket(serverUrl);
        this.ownedServer = ownedServer;
        this.connectionPromise = new Promise((resolve, reject) => {
            this.ws.on('open', () => resolve());
            this.ws.on('error', (err) => reject(err));
        });
        this.setupHandlers();
    }

    public async waitUntilConnected(): Promise<void> {
        return this.connectionPromise;
    }

    private setupHandlers(): void {
        this.ws.on('close', () => {}); // Operate silently
        this.ws.on('message', (data) => {
            try {
                const message = ServerMessageSchema.parse(JSON.parse(data.toString()));
                // Any message with a requestId that we are waiting for is a response.
                if (
                    'requestId' in message
          && message.requestId
          && this.pendingRequests.has(message.requestId)
                ) {
                    const callback = this.pendingRequests.get(message.requestId);
                    if (callback) {
                        callback(message);
                        this.pendingRequests.delete(message.requestId);
                    }
                }
            } catch {
                // If we can't parse a message, it's a real error.
            }
        });
    }

    public async sendRequest(message: ClientMessage): Promise<ServerMessage> {
        return new Promise((resolve, reject) => {
            if (this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected to Core Service.'));
                return;
            }
            this.pendingRequests.set(message.requestId, (response) => {
                if ('success' in response && !response.success) {
                    reject(new Error(response.error ?? 'Request failed'));
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

    public async killOwnedServer(): Promise<void> {
        return new Promise((resolve) => {
            if (this.ownedServer?.pid) {
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
                const handshake = JSON.parse(data.toString()) as {
                    status: string;
                    port: number;
                };
                if (handshake.status === 'listening') {
                    resolve(handshake.port);
                } else {
                    reject(new Error('Server sent unexpected handshake.'));
                }
            } catch {
                reject(new Error('Failed to parse server handshake.'));
            }
        });
        serverProcess.stderr.on('data', (data) => {
            // Forward server errors to our own stderr
            // eslint-disable-next-line no-console
            console.error(data.toString().trim());
        });
        setTimeout(() => reject(new Error('Server launch timed out.')), 5000);
    });

    const port = await portPromise;
    const url = `ws://localhost:${port}`;
    return new CoreServiceClient(url, serverProcess);
}

async function main(): Promise<void> {
    const client = await getOrCreateClient();
    await client.waitUntilConnected();
    const { name, version } = await getPackageInfo();

    const mcpServer = new FastMCP({
        name,
        version: version as `${number}.${number}.${number}`,
    });

    mcpServer.addTool({
        name: 'start_process',
        description: 'Starts a new process in the background.',
        parameters: z.object({ command: z.string() }),
        execute: async ({ command }) => {
            const result = await client.sendRequest({
                action: 'client.start_process',
                requestId: uuidv4(),
                command,
            });
            if (result.action === 'server.request_response') {
                return `Process started with ID: ${(result.data as { id: string }).id}`;
            }
            throw new Error('Unexpected response from server');
        },
    });
    mcpServer.addTool({
        name: 'stop_process',
        description: 'Stops a running process.',
        parameters: z.object({ processId: z.string().uuid() }),
        execute: async ({ processId }) => {
            await client.sendRequest({
                action: 'client.stop_process',
                requestId: uuidv4(),
                processId,
            });
            return `Stop signal sent to process ${processId}.`;
        },
    });
    mcpServer.addTool({
        name: 'clear_process',
        description: 'Clears a stopped process from the list.',
        parameters: z.object({ processId: z.string().uuid() }),
        execute: async ({ processId }) => {
            await client.sendRequest({
                action: 'client.clear_process',
                requestId: uuidv4(),
                processId,
            });
            return `Process ${processId} cleared.`;
        },
    });
    mcpServer.addTool({
        name: 'get_process_output',
        description:
      'Gets the recent output for a process. Can specify `head` or `tail`.',
        parameters: z
            .object({
                processId: z.string().uuid(),
                head: z.number().optional(),
                tail: z.number().optional(),
            })
            .refine((data) => !(data.head && data.tail), {
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
            if (
                result.action === 'server.output_response'
        && Array.isArray(result.output)
            ) {
                return result.output.join('\n');
            }
            throw new Error('Unexpected response from server');
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
            if (result.action === 'server.status_response') {
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
            }
            throw new Error('Unexpected response from server');
        },
    });

    mcpServer.addTool({
        name: 'list_processes',
        description:
      'Gets a list of all processes being managed by the Core Service.',
        parameters: z.object({}),
        execute: async () => {
            const result = await client.sendRequest({
                action: 'client.list_processes',
                requestId: uuidv4(),
            });
            if (result.action === 'server.list_processes_response') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result.processes, null, 2),
                        },
                    ],
                };
            }
            throw new Error('Unexpected response from server');
        },
    });

    const shutdown = async (): Promise<void> => {
        await client.killOwnedServer();
        throw new Error('Shutdown');
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    mcpServer.start({ transportType: 'stdio' });
}

main();
