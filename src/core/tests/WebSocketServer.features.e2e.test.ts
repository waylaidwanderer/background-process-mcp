/* eslint-disable n/no-process-exit */
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import WebSocket from 'ws';

import WebSocketServer from '../WebSocketServer.js';

const TEST_PORT = 8083;

// Helper to create a promise that resolves when the server is ready
const waitForServerReady = (server: WebSocketServer): Promise<void> => new Promise((resolve) => {
    server.wss.on('listening', resolve);
});

describe('WebSocketServer Features E2E', () => {
    let server: WebSocketServer | null = null;
    const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

    beforeEach(() => {
        processExitSpy.mockClear();
    });

    afterEach(async () => {
        if (server) {
            // Manually trigger shutdown to clean up intervals and close the server
            await server.shutdown();
            server = null;
        }
    });

    it(
        'should terminate an unresponsive client after the heartbeat interval',
        async () => {
            server = new WebSocketServer(TEST_PORT);
            await waitForServerReady(server);

            const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

            // This is the magic. By overriding the pong method, we prevent the client
            // from automatically responding to the server's pings.
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            (client as any).pong = (): void => {};

            const closePromise = new Promise<void>((resolve) => {
                client.on('close', () => {
                    resolve();
                });
            });

            await closePromise; // This will resolve when the server terminates us.
        },
        35 * 1000, // Heartbeat needs two cycles (15s*2=30s), so this gives a buffer.
    );

    it(
        'should auto-shutdown when the last client disconnects',
        async () => {
            server = new WebSocketServer(TEST_PORT);
            await waitForServerReady(server);

            const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
            await new Promise((resolve) => client.on('open', resolve));

            // Close the client immediately to start the idle timer.
            client.close();

            // Wait for longer than the shutdown timeout.
            await new Promise((resolve) => {
                setTimeout(resolve, 31 * 1000);
            });

            expect(processExitSpy).toHaveBeenCalledWith(0);
        },
        35 * 1000,
    );

    it(
        'should cancel the auto-shutdown timer when a new client connects',
        async () => {
            server = new WebSocketServer(TEST_PORT);
            await waitForServerReady(server);

            // 1. Client 1 connects and disconnects, starting the timer.
            const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
            await new Promise((resolve) => client1.on('open', resolve));
            client1.close();

            // 2. Wait for a bit, but less than the full shutdown time.
            await new Promise((resolve) => {
                setTimeout(resolve, 10 * 1000);
            });

            // 3. Client 2 connects, which should cancel the timer.
            const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
            await new Promise((resolve) => client2.on('open', resolve));

            // 4. Wait for a period that WOULD have been long enough for the original
            // timer to fire.
            await new Promise((resolve) => {
                setTimeout(resolve, 22 * 1000);
            });

            // 5. Assert that the server has NOT shut down.
            expect(processExitSpy).not.toHaveBeenCalled();

            // 6. (Bonus) Close the second client and confirm it shuts down now.
            client2.close();
            await new Promise((resolve) => {
                setTimeout(resolve, 31 * 1000);
            });
            expect(processExitSpy).toHaveBeenCalledWith(0);
        },
        65 * 1000,
    );
});
