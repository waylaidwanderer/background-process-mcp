# @waylaidwanderer/background-process-mcp

## 1.1.1

### Patch Changes

- Fix(bin): Correct npx execution regression

## 1.1.0

### Minor Changes

- e154391: ### New Features

  - Added a `run_command_sync` tool to the MCP. This allows an agent to execute a shell command and wait for it to complete, receiving the full output synchronously. This is ideal for short-running tasks where the output is expected immediately.

### Patch Changes

- b2667ba: fix(lint): Resolve various linting errors and improve shutdown process.

## 1.0.3

### Patch Changes

- fix(tui): Improve connection logic and error handling

## 1.0.2

### Patch Changes

- Add repository link to package.json

## 1.0.1

### Patch Changes

- Fix the `bin` script to ensure `npx` can execute it correctly.
