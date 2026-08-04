---
applyTo: '**'
---

# copilot-instructions.md

This file provides guidance to Copilot when working with code in this repository.

## 📚 Onboarding

At the start of each session, read:

1. Any `**/README.md` docs across the project
2. Any `**/README.*.md` docs across the project

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:
- [OpenWiki quickstart](../openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

## 🌿 Git Workflow

- **Branch names MUST be prefixed with `claude/`.** When creating a branch for ongoing work,
  name it `claude/<short-description>` — for example `claude/fix-udp-source-validation` or
  `claude/add-influxdb-v3-retry`. This applies to every agent working in this repo, so that
  agent-created branches stay clearly namespaced and are easy to filter or bulk-clean.
- Never commit directly to `master`. Create a branch first, then open a pull request.
- Commits must follow **Conventional Commits**. release-please derives the changelog and the
  version bump from the commit type, so the type matters: `feat` triggers a minor bump, `fix`
  a patch. The types that appear in the changelog are defined in `release-please-config.json`:
  `feat`, `fix`, `chore`, `refactor`, `docs`, `build`, `test`.

## 📝 Doc Site Staging (`docs/to-doc-site`)

User-visible changes must be documented in `docs/to-doc-site`, in the same PR as the code
change — otherwise the change ships and the doc site never learns about it. That covers new
or changed features, config settings, bug fixes an administrator would notice, and new log
messages or status codes an operator might search for.

Skip it for changes with no admin-visible effect: internal refactors, test-only changes,
CI/tooling, and dependency bumps.

**Read `docs/to-doc-site/README.md` before writing.** It is the single source of truth for
when a file is required, who the audience is, and how the file must be named and structured.

## ✅ Quality Gates

When writing code, Copilot must not finish until all of these succeed:

1. `npm run lint:fix`
2. All unit tests (`npm run test:unit`) pass

If any check fails, fix the issues and run checks again.

## 🧱 Project Basics (read this before changing code)

- This repo is **Node.js + ESM** (`"type": "module"` in `package.json`). Prefer `import`/`export` and ESM-compatible patterns.
- Primary runtime entrypoint is `src/butler-sos.js`. A **YAML config file is required** at runtime (passed via `-c/--configfile`).
- Many modules depend on the global singleton in `src/globals.js`. Prefer using existing patterns instead of creating new global singletons.

## GitNexus Code Intelligence

This repo is indexed in GitNexus as `butler-sos`. In this multi-repo workspace, always include `-r butler-sos` on GitNexus CLI commands. GitNexus MCP tools may not be available in VS Code/Copilot chats, so use the CLI unless a `gitnexus_*` tool is actually exposed.

The index is re-generated automatically by git hooks; you should not normally need to
re-index by hand. One-time setup per clone: `npm run gitnexus:install`.

**Never run a bare `npx gitnexus analyze`**, including where the generated GitNexus block in
`CLAUDE.md` / `AGENTS.md` suggests it. It rewrites that managed block and, without `--skills`,
deletes the generated-skills table from both files. Always go through the
`npm run gitnexus:*` scripts, which pass `--skip-agents-md`.

See `docs/README.gitnexus.md` for the hooks, the full command table and version pinning.

Before modifying a function, class, or method, run upstream impact analysis and report the blast radius to the user:

```bash
npx gitnexus impact -r butler-sos <symbolName>
```

If the symbol name is ambiguous, inspect context with a file hint:

```bash
npx gitnexus context -r butler-sos <symbolName> -f src/path/file.js
```

For unfamiliar flows, query the graph before broad grepping:

```bash
npx gitnexus query -r butler-sos "concept or behavior"
```

Before committing or finalizing a broad refactor, verify the affected scope:

```bash
npx gitnexus detect-changes -r butler-sos --scope all
```

Warn the user before editing if impact analysis reports HIGH or CRITICAL risk. Do not rename symbols with blind find-and-replace; use a language-server rename or GitNexus-aware rename support if available, then verify with detect-changes.

## ▶️ How to Run (local dev)

- Install deps: `npm ci`
- Run the app (requires config file): `node src/butler-sos.js -c <path-to-config.yaml>`
- Common scripts:
    - `npm run lint:fix`
    - `npm run test:unit`
    - `npm run format`

## 🧪 Testing (Jest v30 + ES modules)

- Tests use Jest with ESM support (`node --experimental-vm-modules`).
- Use ESM-friendly Jest imports: `import { jest, describe, test, expect } from '@jest/globals';`
- For **ESM mocking**, mock before importing and then dynamically import:
    - Use `jest.unstable_mockModule('some-module', () => ({ ... }))`
    - Then `const mod = await import('some-module');`
- Prefer placing tests in `__tests__/` folders near the code, using the `*.test.js` naming convention.

## 🧹 Linting, Formatting, and Diffs

- The repo enforces **Prettier** and **strict JSDoc rules** via ESLint.
- Do **not** do drive-by formatting/indentation changes “by hand”. Keep diffs focused on the requested change.
- When you add or modify a function/method/class, include complete JSDoc:
    - Describe behavior.
    - List all params (including object param properties when feasible).
    - List return type(s), including Promises.
    - Insert an empty line between param and return sections.

## 🔐 Config, Secrets, and Security-Sensitive Behavior

- Never add real secrets/keys/certificates/tokens to the repo. Keep configuration changes in templates/examples only.
- Prefer **config-driven** behavior (YAML config + the `config` package) over introducing new env vars or hard-coded values.
- Be careful when changing system information collection:
    - On Windows, the `systeminformation` dependency may execute OS commands.
    - There is a config option to disable detailed system info (`Butler-SOS.systemInfo.enable`).

## 🪵 Logging & Error Handling

- Use the existing logger (`globals.logger`) and keep log messages free of secrets (tokens, credentials, certificate contents).
- When logging errors, prefer the SEA-aware helpers in `src/lib/log-error.js` (`logError`, `logWarn`, etc.) so packaged builds stay readable.

## 📦 Packaging (Docker + SEA)

- Docker builds install **production dependencies only** (`npm ci --omit=dev`). If code needs a runtime dependency, it must be in `dependencies`, not `devDependencies`.
- Avoid changes that assume developer-only tooling exists at runtime.

## 🌐 Fastify Plugins

- Cross-cutting behavior for HTTP routes should be implemented as Fastify plugins under `src/plugins/` (using `fastify-plugin` patterns), not duplicated across routes.

## 🚫 Repo Hygiene

- Do not edit generated artifacts or dependencies (e.g. `node_modules/`, `build/`, `coverage/`) unless the task explicitly requires it.
