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
---

## 3. Release Process

This project uses a manual versioning process combined with an automated GitHub Action for creating releases. Follow these steps precisely to publish a new version.

### Step 1: Update Versions and Changelog

Manually update the version number in the following files to the new desired version (e.g., `1.2.5`):

-   `package.json`
-   `gemini-extension.json`

Next, open `CHANGELOG.md` and add a new entry at the top for the new version, detailing all the changes.

### Step 2: Commit the Release Changes

Commit the version and changelog updates.

```bash
git add .
git commit -m "chore: release vX.Y.Z"
```

### Step 3: Tag the Release Commit

Create a git tag that exactly matches the new version number.

```bash
git tag vX.Y.Z
```

### Step 4: Push to GitHub

Push the commit and the tag to GitHub. Pushing the tag is the event that will trigger the automated release process.

```bash
git push
git push --tags
```

### Step 5: Publish to NPM

Once the commit and tag are pushed, publish the new version to the npm registry. This is done last to ensure the git state is clean and the tag exists, which is a safety check performed by pnpm.

```bash
pnpm publish
```

**Note:** This command will prompt for manual browser authentication. The agent must wait for the user to complete this step. The publish is successful once the command finishes and the output includes the line `+ @waylaidwanderer/background-process-mcp@X.Y.Z`.

### Step 6: The Automation Takes Over

Pushing the new tag will trigger the `release.yml` GitHub Action, which will:

1.  Create a new, public GitHub Release for the tag.
2.  Automatically populate the release notes from the entry in `CHANGELOG.md`.
3.  Build the extension for all supported platforms (Linux x64, macOS arm64).
4.  Attach the compiled, platform-specific `.tar.gz` archives to the GitHub Release as assets.

Once the action is complete, the new version is fully released.
