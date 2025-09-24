# Agent Architecture: Background Process MCP

This document defines the core architectural principles for this project. All development must adhere to these principles to ensure a robust, maintainable, and consistent system.

## 1. Core Principle: Server-Centric, Single Source of Truth

The entire system is built on a strict server-centric model. The **Core Service** is the absolute and only source of truth for all state within the application. Clients are considered "dumb" renderers of this state.

**DO NOT** store any persistent state on the clients (TUI, MCP). A client should be able to disconnect and reconnect at any time and be brought back to the correct state entirely by the server.

---

## 2. Component Responsibilities

### 2.1. The Core Service (`ProcessManager` & `WebSocketServer`)

**The Core Service is the brain and the state machine.**

-   **Single Source of Truth:** It exclusively owns and manages all process state, including:
    -   The list of all running and stopped processes.
    -   The Process ID (`processId`), command, PID, and status of each process.
    -   The complete, capped output history for every process.
-   **Lifecycle Management:** It is solely responsible for spawning (`node-pty`), terminating (`tree-kill`), and cleaning up child processes.
-   **Business Logic:** It enforces all system rules, such as the concurrent process limit.
-   **Data Transformation:** It is responsible for preparing data for consumers (e.g., stripping ANSI codes for the MCP client).
-   **Communication Hub:** It manages the WebSocket server, broadcasting state changes to all connected clients and responding to direct requests.

### 2.2. The Clients (TUI & MCP)

**Clients are stateless views and command issuers.**

-   **Stateless:** Clients **MUST NOT** store their own long-term state, especially output history. They should render the state provided by the server.
-   **View Rendering:** Their primary responsibility is to present the server's state to the user or the LLM. The TUI renders a visual dashboard; the MCP client formats data for the LLM.
-   **Command Issuers:** They translate user/LLM input into well-formed command messages (e.g., `client.start_process`) and send them to the Core Service.
-   **Ephemeral State Only:** The only state a client should manage is transient UI state (e.g., which item is currently selected in a list). This state should be easily reconstructible upon reconnecting.
