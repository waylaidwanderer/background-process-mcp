#!/usr/bin/env node
import minimist from 'minimist';

async function main() {
  const args = minimist(process.argv.slice(2));
  const command = args._[0];

  switch (command) {
    case 'server':
      await import('./server.js');
      break;
    case 'ui':
      if (!args.port) {
        console.error('Error: The --port argument is required for the UI client.');
        console.error('Usage: bg-mcp ui --port <port_number>');
        process.exit(1);
      }
      // Pass args to the module
      process.env.BG_MCP_PORT = args.port.toString();
      if (args.debug) {
        process.env.BG_MCP_DEBUG = 'true';
      }
      const { runTUI } = await import('./tui.js');
      runTUI();
      break;
    default:
      // Default command is the smart MCP client
      await import('./mcp.js');
      break;
  }
}

main().catch(console.error);