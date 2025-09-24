# @waylaidwanderer/bg-mcp

This project provides a robust, decoupled system for managing background shell processes. It consists of a headless core service that can be controlled by both an LLM (via an MCP client) and a human user (via a separate TUI client), with all communication happening over a local WebSocket connection.

## Architecture

The system is composed of three distinct parts:

1.  **The Core Service:** A standalone, headless Node.js application. This is the brain. It runs the `ProcessManager` and the WebSocket server.
2.  **The TUI Client:** A separate, runnable Node.js application. This is the user's interactive dashboard. It connects to the Core Service.
3.  **The MCP Client:** A lightweight Node.js module. This is the LLM's interface. It also connects to the Core Service.

For a detailed breakdown of the architectural principles, see `AGENTS.md`.

## Features

-   **Remote Process Management:** Start, stop, and monitor any shell command.
-   **Real-time TUI:** A `blessed`-based terminal interface for live monitoring and manual control.
-   **LLM Integration:** An MCP server with tools for programmatic process management.
-   **Decoupled & Robust:** A server-centric architecture ensures a single source of truth.
-   **Safe & Port-Aware:** Enforces concurrent process limits, guarantees graceful shutdown, and automatically finds and uses an open port.
-   **High-Fidelity Output:** Uses `node-pty` to capture rich terminal output with colors and formatting for the TUI.

## Getting Started

### Prerequisites

-   Node.js (v18+)
-   pnpm (for development)

### Installation

For local development:
1.  Clone the repository:
    ```bash
    git clone <repo-url>
    cd background-process-mcp
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3. Build the project:
    ```bash
    pnpm build
    ```

### Usage

The tool is designed to be run directly with `npx` (or `pnpx` after a global link).

#### For Agents / Automated Usage (Recommended)

Simply run the main command. It will automatically handle launching and cleaning up the server process.

```bash
npx @waylaidwanderer/bg-mcp
```

This command will:
1.  Check if a `bg-mcp` server is already running for the current context.
2.  If not, it will launch one in the background.
3.  It will then start the MCP server, connected and ready for the agent to use.
4.  When the MCP process exits, it will automatically terminate the server it launched.

To connect to a specific, pre-existing server, use the `--port` flag:
```bash
npx @waylaidwanderer/bg-mcp --port 31337
```

#### For Manual Usage

If you want to manage the server and UI manually (e.g., for long-running tasks you want to monitor), use the explicit subcommands.

1.  **Start the Core Service (in one terminal):**
    ```bash
    npx @waylaidwanderer/bg-mcp server
    ```
    The server will start and print a JSON message with the port it's using, e.g., `{"status":"listening","port":31337,...}`.

2.  **Run the TUI Client (in a separate terminal):**
    ```bash
    npx @waylaidwanderer/bg-mcp ui --port 31337
    ```
    The terminal dashboard will appear, connected to the server you started.


### Running Tests (for development)

To run the unit and end-to-end tests:

```bash
pnpm test
```

To run the type-checker:

```bash
pnpm typecheck
```
