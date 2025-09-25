import React from 'react';

import { render } from 'ink';

import App from './tui/App.js';

function getServerUrl(): string {
    const port = process.env.BG_MCP_PORT;
    if (!port) {
        throw new Error(
            'Error: Port not provided. This module should be launched via the CLI.',
        );
    }
    return `ws://localhost:${port}`;
}

export default function runTUI(): void {
    const serverUrl = getServerUrl();
    const isDebugMode = process.env.BG_MCP_DEBUG === 'true';

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

    const app = render(React.createElement(App, { serverUrl, isDebugMode }));

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
