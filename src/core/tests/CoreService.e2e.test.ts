import { v4 as uuidv4 } from 'uuid';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import WebSocket from 'ws';

import WebSocketServer from '../WebSocketServer.js';

import type { ClientMessage, ServerMessage } from '../../types/index.js';

const TEST_PORT = 8082;

// Helper to manage client connections and message collection
const createTestClient = async (): Promise<{
    client: WebSocket;
    messages: ServerMessage[];
}> => {
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const messages: ServerMessage[] = [];

    client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()) as ServerMessage);
    });

    await new Promise((resolve) => {
        client.on('open', resolve);
    });

    // The first message is always full_state, so we wait for it and clear it.
    await new Promise((resolve) => {
        setTimeout(resolve, 20);
    });
    messages.length = 0;

    return { client, messages };
};

describe('Core Service E2E', () => {
    let server: WebSocketServer;

    beforeAll(() => {
        server = new WebSocketServer(TEST_PORT);
    });

    afterAll(() => {
        server.wss.close();
    });

    it('should allow a client to connect and receive the full state', async () => {
        const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
        const messagePromise = new Promise<ServerMessage>((resolve) => {
            client.on('message', (data) => resolve(JSON.parse(data.toString()) as ServerMessage));
        });
        await new Promise((resolve) => {
            client.on('open', resolve);
        });
        const message = await messagePromise;
        if (message.action !== 'server.full_state') {
            throw new Error('Expected full_state message');
        }
        expect(message.action).toBe('server.full_state');
        expect(message.processes).toEqual([]);
        client.close();
    });

    it('should handle the full lifecycle', async () => {
        // === 1. Logger Client: Start and observe a process ===
        const logger = await createTestClient();
        const command = 'echo "line 1"; sleep 0.1; echo "line 2"; sleep 0.1; echo "line 3"';
        const startRequest: ClientMessage = {
            action: 'client.start_process',
            requestId: uuidv4(),
            command,
        };
        logger.client.send(JSON.stringify(startRequest));

        // Wait for the process to run and finish
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });

        const startResponse = logger.messages.find(
            (m) => m.action === 'server.request_response',
        );
        expect(startResponse?.success).toBe(true);
        const processId = startResponse?.data.id;
        expect(processId).toBeDefined();

        const outputMessages = logger.messages.filter(
            (m) => m.action === 'server.process_output',
        );
        const fullCleanOutput = outputMessages.map((m) => m.cleanOutput).join('');
        expect(fullCleanOutput).toContain('line 1');
        expect(fullCleanOutput).toContain('line 2');
        expect(fullCleanOutput).toContain('line 3');

        const stoppedMessage = logger.messages.find(
            (m) => m.action === 'server.process_stopped',
        );
        if (stoppedMessage?.action !== 'server.process_stopped') {
            throw new Error('Type guard failed');
        }
        expect(stoppedMessage).toBeDefined();
        expect(stoppedMessage.process.exitCode).toBe(0);
        logger.client.close();

        // === 2. History Client: Connect and verify history ===
        const historyChecker = await createTestClient();
        const outputRequest: ClientMessage = {
            action: 'client.request_output',
            requestId: uuidv4(),
            processId,
        };
        historyChecker.client.send(JSON.stringify(outputRequest));

        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });

        const outputResponse = historyChecker.messages.find(
            (m) => m.action === 'server.output_response',
        );
        expect(outputResponse).toBeDefined();
        const fullHistory = outputResponse?.output.join('');
        expect(fullHistory).toContain('line 1');
        expect(fullHistory).toContain('line 2');
        expect(fullHistory).toContain('line 3');
        historyChecker.client.close();

        // === 3. Clear Client: Connect and clear the process ===
        const clearClient = await createTestClient();
        const clearRequest: ClientMessage = {
            action: 'client.clear_process',
            requestId: uuidv4(),
            processId,
        };
        clearClient.client.send(JSON.stringify(clearRequest));
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        const clearResponse = clearClient.messages.find(
            (m) => m.action === 'server.request_response',
        );
        expect(clearResponse?.success).toBe(true);
        clearClient.client.close();

        // === 4. Verifier Client: Connect and ensure process is gone ===
        const verifier = new WebSocket(`ws://localhost:${TEST_PORT}`);
        const finalState = await new Promise<ServerMessage>((resolve) => {
            verifier.on('message', (data) => resolve(JSON.parse(data.toString()) as ServerMessage));
        });
        if (finalState.action !== 'server.full_state') {
            throw new Error('Expected full_state message');
        }
        expect(finalState.action).toBe('server.full_state');
        expect(finalState.processes).toHaveLength(0);
        verifier.close();
    });
});
