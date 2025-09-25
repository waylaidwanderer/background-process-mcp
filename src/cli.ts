/* eslint-disable no-console */
import minimist from 'minimist';

async function main(): Promise<void> {
    const args = minimist(process.argv.slice(2));
    const command = args._[0];

    switch (command) {
        case 'server': {
            await import('./server.js');
            break;
        }
        case 'ui': {
            if (!args.port) {
                console.error(
                    'Error: The --port argument is required for the UI client.',
                );
                console.error('Usage: bgpm ui --port <port_number>');
                throw new Error('Missing --port argument.');
            }
            // Pass args to the module
            process.env.BG_MCP_PORT = args.port.toString();
            if (args.debug) {
                process.env.BG_MCP_DEBUG = 'true';
            }
            const { default: runTUI } = await import('./tui.js');
            runTUI();
            break;
        }
        default: {
            await import('./mcp.js');
            break;
        }
    }
}

main().catch((error) => {
    console.error(error);
    throw error;
});
