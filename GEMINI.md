# Background Process Manager Extension

This extension provides a robust set of tools for managing background processes. It is your primary interface for any long-running or interactive tasks.

## Usage Strategy

### Core Principles

1.  **Long-Running & Interactive Processes:** You **MUST** use `start_process` for any command that does not exit immediately or may require user input. This is non-negotiable.
    *   **Examples:** `npm run dev`, `vite`, `tsc --watch`, servers, or any kind of file watcher.

2.  **Short-Lived Commands (The Exception):** For short-lived, synchronous commands (e.g., `ls`, `cat`, `pnpm test`, `pnpm build`), you should **ALWAYS prefer your native shell tool** (e.g., `run_shell_command`).
    *   Only use `run_command_sync` as a fallback if the native tool is failing, or for specific, niche reasons where running the command through this MCP provides a clear advantage.

---

## Available Tools

-   `start_process`: Starts a new process in the background. **This is the required tool for all long-running commands (servers, watchers) or interactive tasks.**
    -   `command` (string): The command to run.
-   `stop_process`: Stops a running background process.
    -   `processId` (string): The UUID of the process to stop.
-   `clear_process`: Clears a stopped background process from the list.
    -   `processId` (string): The UUID of the process to clear.
-   `get_process_output`: Gets the recent output for a background process. Can specify `head` or `tail`.
    -   `processId` (string): The UUID of the process.
    -   `head` (number, optional): Get the first N lines of output.
    -   `tail` (number, optional): Get the last N lines of output.
-   `get_server_status`: Gets the current status of the Background Process Manager server.
-   `list_processes`: Gets a list of all processes being managed by the Background Process Manager.
-   `run_command_sync`: Runs a short-lived command and waits for it to complete. **You should prefer your native shell tools for this.** Use this tool only when there is a specific need to run a synchronous command within the context of this MCP.
    -   `command` (string): The command to run.
