<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **butler-sos**. Use GitNexus to understand code, assess impact, and navigate safely.

> In VS Code/Copilot chats, GitNexus MCP functions may not be exposed. Prefer the CLI commands below unless a `gitnexus_*` tool is actually available. In this multi-repo workspace, always pass `-r butler-sos` to GitNexus CLI commands.

Start with:

```bash
npx gitnexus status
```

If the index is stale, run:

```bash
npx gitnexus analyze
```

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `npx gitnexus impact -r butler-sos <symbolName>` and report the blast radius (direct callers, affected processes, risk level) to the user. If MCP tools are available, `gitnexus_impact({target: "symbolName", direction: "upstream"})` is also acceptable.
- **MUST run `npx gitnexus detect-changes -r butler-sos --scope all` before committing** to verify your changes only affect expected symbols and execution flows. If MCP tools are available, `gitnexus_detect_changes()` is also acceptable.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `npx gitnexus query -r butler-sos "concept"` to find execution flows before broad grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `npx gitnexus context -r butler-sos <symbolName>`. Add `-f <path>` to disambiguate common names.

## Never Do

- NEVER edit a function, class, or method without first running GitNexus impact analysis on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace. Use GitNexus-aware rename support if available, or do a focused language-server rename and verify with `npx gitnexus detect-changes -r butler-sos --scope all`.
- NEVER commit changes without running GitNexus detect-changes to check affected scope.

## Resources

| Resource | Use for |
| ---------- | --------- |
| `gitnexus://repo/butler-sos/context` | Codebase overview, check index freshness |
| `gitnexus://repo/butler-sos/clusters` | All functional areas |
| `gitnexus://repo/butler-sos/processes` | All execution flows |
| `gitnexus://repo/butler-sos/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Command |
| ------ | --------- |
| Check index status | `npx gitnexus status` |
| Rebuild stale index | `npx gitnexus analyze` |
| Explore a concept | `npx gitnexus query -r butler-sos "concept"` |
| Full symbol context | `npx gitnexus context -r butler-sos <symbolName>` |
| Disambiguated context | `npx gitnexus context -r butler-sos <symbolName> -f src/path/file.js` |
| Impact analysis | `npx gitnexus impact -r butler-sos <symbolName>` |
| Detect affected scope | `npx gitnexus detect-changes -r butler-sos --scope all` |

<!-- gitnexus:end -->

## Butler SOS — Agent Guide

## Commands

- `npm ci` — install deps
- `npm run lint:fix` then `npm run test:unit` — required quality gates before commit
- `npm run test:unit` — Jest with ESM (uses `node --experimental-vm-modules`)
- Single test: `node --experimental-vm-modules node_modules/jest/bin/jest.js src/path/to/file.test.js`
- `npm run format` — Prettier (100 printWidth, 4 tabWidth, single quotes)

## Architecture

- **Runtime entrypoint**: `src/butler-sos.js` — requires YAML config via `-c/--configfile`
- **Global singleton**: `src/globals.js` (Settings class) — many modules depend on it; prefer existing patterns
- **Config**: YAML file loaded via `config` package; template at `src/config/production_template.yaml`
- **Plugins**: Fastify plugins in `src/plugins/`; use `fastify-plugin` patterns
- **Tests**: `__tests__/` folders next to code, `*.test.js` naming, ESM imports from `@jest/globals`

## Conventions

- **ESM only** (`"type": "module"`) — use `import`/`export`, avoid `require`
- **JSDoc enforced** — ESLint with `eslint-plugin-jsdoc`; document all params, returns, and Promise types
- **Logging** — use `globals.logger` (winston-based), never `console.log`; use `src/lib/log-error.js` helpers for SEA compatibility
- **Config-driven** — prefer YAML config + `config` package over env vars or hard-coded values
- **Dependencies** — Docker/SEA builds use `--omit=dev`; runtime deps must be in `dependencies`, not `devDependencies`

## SEA (Single Executable App)

- `src/lib/sea-wrapper.js` provides `isSea()` and path helpers
- In SEA binaries, `__dirname`/`__filename` are unavailable; use the sea wrapper
- Suppression of `DEP0169` warnings from `@influxdata/influxdb3-client` is in `src/butler-sos.js:34-48`

## Security

- No real secrets/keys/certs in repo — config templates/examples only
- `systeminformation` package may execute privileged OS commands on Windows — respect `Butler-SOS.systemInfo.enable` config option
