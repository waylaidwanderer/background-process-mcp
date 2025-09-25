import React from 'react';

import { render } from 'ink';
import WebSocket from 'ws';

import App from './tui/App.js';

function getServerUrl(): string {
    const port = process.env.BG_MCP_PORT;
    if (!port) {
        // This error is for developers, should be seen.
        // eslint-disable-next-line no-console
        console.error(
            'Error: Port not provided. This module should be launched via the CLI.',
        );
        process.exit(1);
    }
    return `ws://localhost:${port}`;
}

/**
 * Performs a pre-flight check to ensure the server is available.
 * @param url The WebSocket server URL.
 */
async function preflightCheck(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);

        const onError = (err: Error): void => {
            ws.close();
            reject(err);
        };

        ws.once('open', () => {
            ws.close(); // We don't need this connection, it was just a check.
            resolve();
        });

        ws.once('error', onError);
    });
}

export default async function runTUI(): Promise<void> {
    const serverUrl = getServerUrl();
    const isDebugMode = process.env.BG_MCP_DEBUG === 'true';

    try {
        await preflightCheck(serverUrl);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        // eslint-disable-next-line no-console
        console.error(`Failed to connect to Core Service: ${errorMessage}`);
        process.exit(1);
    }

    const enterAltScreen = (): void => {
        process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
    };

    const exitAltScreen = (): void => {
        process.stdout.write('\x1b[?1049l'); // Exit
    };

    const cleanup = (): void => {
        exitAltScreen();
    };

    // Graceful exit handler
    const handleCleanExit = (): void => {
        cleanup();
        process.exit(0);
    };

    // Ensure we exit the alternate screen on any kind of exit
    process.on('SIGINT', handleCleanExit);
    process.on('SIGTERM', handleCleanExit);
    process.on('exit', cleanup);

    enterAltScreen();

    const app = render(
        React.createElement(App, { serverUrl, isDebugMode }),
    );

    app
        .waitUntilExit()
        .then(handleCleanExit)
        .catch((error) => {
            cleanup();
            // eslint-disable-next-line no-console
            console.error('TUI encountered an unexpected error:', error);
            process.exit(1);
        });
}
