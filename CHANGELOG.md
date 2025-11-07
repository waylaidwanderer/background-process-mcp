# @waylaidwanderer/background-process-mcp

## 1.2.9

### Changed

-   **Archive Creation:** `.github/create-archive.js` now bundles the CLI with esbuild, injects package metadata, and builds a `node-pty` prebuilt matrix for Node 20/22/24 so the shipped `cli.js` works across Node versions without rebuilding native modules. The packaging step also copies the module's prebuilt binaries into `node_modules/node-pty/prebuilt/node-v<abi>`.
-   **runtime bootstrap:** The Core Service proactively installs the right `node-pty` binary at startup, so switching Node versions no longer breaks existing release archives.
-   **Gemini CLI:** `gemini-extension.json` now points directly at the bundled `cli.js`, matching the structure produced in release archives.

## 1.2.8

### Fixed

-   **Release Archives:** The packaging script now correctly copies the root `node_modules` directory into the release archive. This fixes a critical bug where the pre-built extension was missing all its dependencies, including the native `node-pty` module.

## 1.2.7

### Fixed

-   **ESM Compatibility:** The `bin/bgpm` script has been rewritten to use ES Module syntax (`import`) instead of CommonJS (`require`). This fixes a crash on launch caused by the project's `"type": "module"` setting in `package.json`.

## 1.2.6

### Changed

-   **Self-Bootstrapping Installation:** The extension's entry script (`bin/bgpm`) now automatically detects if the project has been built. If the `dist` folder is missing (as in a git clone), it will run `pnpm install` and `pnpm build` to compile itself, making git-based installations much more robust.

## 1.2.5

### Fixed

-   **Extension Installation:** Corrected the release asset naming convention to use the name from `gemini-extension.json` (`background-process`) instead of `package.json`. This allows the Gemini CLI to correctly find and download the pre-built archives instead of falling back to a git clone.

## 1.2.4

### Fixed

-   **Gemini Extension Command:** Corrected the `mcpServers` configuration in `gemini-extension.json` to use the proper `bin/bgpm` entry point instead of directly calling the script. This ensures the extension starts up in the same robust manner as it would from the command line.

## 1.2.3

### Added

-   **Gemini Extension Support:** The project can now be installed and used as a Gemini CLI extension.
-   **Automated GitHub Releases:** Added a GitHub Actions workflow to automatically build and release platform-specific assets for Linux (x64) and macOS (arm64) whenever a new version tag is pushed.
-   **Extension Context:** Included a `GEMINI.md` file to provide the model with a clear usage strategy for the available tools.

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
