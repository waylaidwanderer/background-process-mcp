import React from 'react';
import { render } from 'ink';
import { App } from './tui/App.js';

function getServerUrl(): string {
  const port = process.env.BG_MCP_PORT;
  if (!port) {
    console.error('Error: Port not provided. This module should be launched via the CLI.');
    process.exit(1);
  }
  return `ws://localhost:${port}`;
}

export function runTUI() {
  const serverUrl = getServerUrl();
  const isDebugMode = process.env.BG_MCP_DEBUG === 'true';

  const enterAltScreen = () => {
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
  };

  const exitAltScreen = () => {
    process.stdout.write('\x1b[?1049l'); // Exit
  };

  // Graceful exit handler
  const handleExit = () => {
    exitAltScreen();
    process.exit(0);
  };

  // Ensure we exit the alternate screen on any kind of exit
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  process.on('exit', exitAltScreen);

  enterAltScreen();
  
  const app = render(React.createElement(App, { serverUrl, isDebugMode }));

  app.waitUntilExit().then(handleExit).catch(error => {
    exitAltScreen();
    console.error(error);
    process.exit(1);
  });
}