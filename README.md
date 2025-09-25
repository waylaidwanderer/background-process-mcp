# Background Process MCP

A Model Context Protocol (MCP) server that provides background process management capabilities. This server enables LLMs to start, stop, and monitor long-running command-line processes.

## Motivation

Some AI agents, like Claude Code, can manage background processes natively, but many others can't. This project provides that capability as a standard tool for other agents like Google's Gemini CLI. It works as a separate service, making long-running task management available to a wider range of agents. I also added a TUI because I wanted to be able to monitor the processes myself.

## Getting Started

To get started, install the Background Process MCP server in your preferred client.

**Standard Config**

This configuration works for most MCP clients:

```json
{
  "mcpServers": {
    "backgroundProcess": {
      "command": "npx",
      "args": [
        "@waylaidwanderer/background-process-mcp@latest"
      ]
    }
  }
}
```

To connect to a standalone server, add the `--port` argument to the `args` array (e.g., `...mcp@latest", "--port", "31337"]`).

<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the Background Process MCP server:

```bash
claude mcp add backgroundProcess npx @waylaidwanderer/background-process-mcp@latest
```
</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Codex</summary>

Create or edit the configuration file `~/.codex/config.toml` and add:

```toml
[mcp_servers.backgroundProcess]
command = "npx"
args = ["@waylaidwanderer/background-process-mcp@latest"]
```

For more information, see the [Codex MCP documentation](https://github.com/openai/codex/blob/main/codex-rs/config.md#mcp_servers).

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=Background%20Process%20MCP&config=eyJjb21tYW5kIjoibnB4IEB3YXlsYWlkd2FuZGVyZXIvYmFja2dyb3VuZC1wcm9jZXNzLW1jcEBsYXRlc3QifQ==)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name it `backgroundProcess`, use `command` type with the command `npx @waylaidwanderer/background-process-mcp@latest`.

</details>

<details>
<summary>Gemini CLI</summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

</details>

<details>
<summary>Goose</summary>

#### Click the button to install:

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=%40waylaidwanderer%2Fbackground-process-mcp%24latest&id=backgroundProcess&name=Background%20Process%20MCP&description=Manage%20long-running%20command-line%20processes.)

#### Or install manually:

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name it `backgroundProcess`, use type `STDIO`, and set the `command` to `npx @waylaidwanderer/background-process-mcp@latest`. Click "Add Extension".
</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server backgroundProcess to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=backgroundProcess&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAd2F5bGFpZHdhbmRlcmVyL2JhY2tncm91bmQtcHJvY2Vzcy1tY3BAbGF0ZXN0Il19)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.
</details>

<details>
<summary>opencode</summary>

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "backgroundProcess": {
      "type": "local",
      "command": [
        "npx",
        "@waylaidwanderer/background-process-mcp@latest"
      ],
      "enabled": true
    }
  }
}
```
</details>

<details>
<summary>Qodo Gen</summary>

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click `Save`.
</details>

<details>
<summary>VS Code (for GitHub Copilot)</summary>

#### Click the button to install:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22backgroundProcess%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40waylaidwanderer%2Fbackground-process-mcp%40latest%22%5D%7D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22backgroundProcess%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40waylaidwanderer%2Fbackground-process-mcp%40latest%22%5D%7D)

#### Or install manually:

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"backgroundProcess","command":"npx","args":["@waylaidwanderer/background-process-mcp@latest"]}'
```
</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

## Tools

The following tools are exposed by the MCP server.

<details>
<summary><b>Process Management</b></summary>

- **start_process**
  - Description: Starts a new process in the background.
  - Parameters:
    - `command` (string): The shell command to execute.
  - Returns: A confirmation message with the new process ID.

- **stop_process**
  - Description: Stops a running process.
  - Parameters:
    - `processId` (string): The UUID of the process to stop.
  - Returns: A confirmation message.

- **clear_process**
  - Description: Clears a stopped process from the list.
  - Parameters:
    - `processId` (string): The UUID of the process to clear.
  - Returns: A confirmation message.

- **get_process_output**
  - Description: Gets the recent output for a process. Can specify `head` for the first N lines or `tail` for the last N lines.
  - Parameters:
    - `processId` (string): The UUID of the process to get output from.
    - `head` (number, optional): The number of lines to get from the beginning of the output.
    - `tail` (number, optional): The number of lines to get from the end of the output.
  - Returns: The requested process output as a single string.

- **list_processes**
  - Description: Gets a list of all processes being managed by the Core Service.
  - Parameters: None
  - Returns: A JSON string representing an array of all process states.

- **get_server_status**
  - Description: Gets the current status of the Core Service.
  - Parameters: None
  - Returns: A JSON string containing server status information (version, port, PID, uptime, process counts).

</details>

## Architecture

The project has three components:

1.  **Core Service (`src/server.ts`)**: A standalone WebSocket server that uses `node-pty` to manage child process lifecycles. It is the single source of truth for all process states. It is designed to be standalone so that other clients beyond the official TUI and MCP can be built for it.

2.  **MCP Client (`src/mcp.ts`)**: Exposes the Core Service functionality as a set of tools for an LLM agent. It can connect to an existing service or spawn a new one.

3.  **TUI Client (`src/tui.ts`)**: An `ink`-based terminal UI that connects to the Core Service to display process information and accept user commands.

## Manual Usage

If you wish to run the server and TUI manually outside of an MCP client, you can use the following commands.

For a shorter command, you can install the package globally:

```bash
pnpm add -g @waylaidwanderer/background-process-mcp
```

This will give you access to the `bgpm` command.

### 1. Run the Core Service

Start the background service manually:

```bash
# With npx
npx @waylaidwanderer/background-process-mcp server

# Or, if installed globally
bgpm server
```

The server will listen on an available port (defaulting to `31337`) and output a JSON handshake with the connection details.

### 2. Use the TUI

Connect the TUI to a running server via its port:

```bash
# With npx
npx @waylaidwanderer/background-process-mcp ui --port <port_number>

# Or, if installed globally
bgpm ui --port <port_number>
```