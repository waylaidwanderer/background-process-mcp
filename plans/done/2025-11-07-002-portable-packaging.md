# Portable Packaging Improvements

**PLAN_ID**: 2025-11-07-002-portable-packaging
**Status**: done

## Objective
Ensure the release archive's `cli.js` works across supported Node versions without rebuilding native modules, and update Gemini configuration to invoke the bundled CLI directly.

## Acceptance Criteria
- `.github/create-archive.js` bundles platform-specific `node-pty` binaries compatible with Node 20+ regardless of the packaging runner's Node version.
- Release archives include the assets required for Windows, Linux, and macOS targets to run `cli.js` directly with `node <cli>`.
- `gemini-extension.json` references the bundled `cli.js` entry point instead of `bin/bgpm`.
- Tests and lint pass after the changes, and documentation (changelog) reflects the update.

## Scope
- **In scope:** Packaging script updates, dependency adjustments, Gemini config change, changelog entry.
- **Out of scope:** Broader runtime refactors, unrelated feature work.

## Checklist
[x] Analyze current packaging failure
[x] Implement portable packaging
  [x] Decide on prebuilt strategy
  [x] Update packaging script
  [x] Verify multi-node compatibility locally
  [x] Tests: unit updated
  [x] Tests: integration updated (if applicable)
  [x] Typecheck and lint
[x] Gemini config & docs
  [x] Update gemini-extension.json
  [x] Update CHANGELOG
[x] Request final confirmation

## Decisions
- 

## Dependencies
List upstream and downstream items.

## Authorizations
- 2025-11-07 — "Proceed"

## Links
Commits and artifacts.
