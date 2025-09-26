# @waylaidwanderer/background-process-mcp

## 1.2.0

### Minor Changes

- 8ce87c9: feat: Improve tool descriptions for clarity

  The descriptions for the MCP tools have been updated to be more explicit about their intended use, distinguishing between background/long-running processes and synchronous/short-lived commands. This helps agents make better decisions about which tool to use.

## 1.1.2

### Patch Changes

- Fix(ci): Enforce LF line endings for bin/bgpm via .gitattributes to ensure cross-platform compatibility.

## 1.1.1

### Patch Changes

- Fix(bin): Correct npx execution regression

## 1.1.0

### Minor Changes

- e154391: ### New Features

  - Added a `run_command_sync` tool to the MCP. This allows an agent to execute a shell command and wait for it to complete, receiving the full output synchronously. This is ideal for short-running tasks where the output is expected immediately.

### Patch Changes

- b2667ba: fix(lint): Resolve various linting errors and improve shutdown process.

## 1.0.5

### Patch Changes

- Fix: The `bin/bgpm` executable is now a Node.js script to reliably resolve the path to `dist/cli.js`, fixing issues where `npx` would fail to find the module due to symlinking.

## 1.0.4

### Patch Changes

- Fix: Add `dist` and `bin` directories to the `files` array in `package.json` to ensure they are included in the published package.

## 1.0.3

### Patch Changes

- fix(tui): Improve connection logic and error handling

## 1.0.2

### Patch Changes

- Add repository link to package.json

## 1.0.1

### Patch Changes

- Fix the `bin` script to ensure `npx` can execute it correctly.
