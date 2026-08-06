<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **butler-sos** (2919 symbols, 5442 relationships, 247 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/butler-sos/context` | Codebase overview, check index freshness |
| `gitnexus://repo/butler-sos/clusters` | All functional areas |
| `gitnexus://repo/butler-sos/processes` | All execution flows |
| `gitnexus://repo/butler-sos/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Influxdb area (82 symbols) | `.claude/skills/generated/influxdb/SKILL.md` |
| Work in the Configvis area (77 symbols) | `.claude/skills/generated/configvis/SKILL.md` |
| Work in the V2 area (46 symbols) | `.claude/skills/generated/v2/SKILL.md` |
| Work in the Globals area (36 symbols) | `.claude/skills/generated/globals/SKILL.md` |
| Work in the Cluster_29 area (21 symbols) | `.claude/skills/generated/cluster-29/SKILL.md` |
| Work in the Cluster_19 area (20 symbols) | `.claude/skills/generated/cluster-19/SKILL.md` |
| Work in the Cluster_51 area (16 symbols) | `.claude/skills/generated/cluster-51/SKILL.md` |
| Work in the V1 area (14 symbols) | `.claude/skills/generated/v1/SKILL.md` |
| Work in the Handlers area (14 symbols) | `.claude/skills/generated/handlers/SKILL.md` |
| Work in the Util area (13 symbols) | `.claude/skills/generated/util/SKILL.md` |
| Work in the Json area (10 symbols) | `.claude/skills/generated/json/SKILL.md` |
| Work in the Cluster_37 area (10 symbols) | `.claude/skills/generated/cluster-37/SKILL.md` |
| Work in the Cluster_25 area (8 symbols) | `.claude/skills/generated/cluster-25/SKILL.md` |
| Work in the Cluster_16 area (7 symbols) | `.claude/skills/generated/cluster-16/SKILL.md` |
| Work in the Cluster_22 area (7 symbols) | `.claude/skills/generated/cluster-22/SKILL.md` |
| Work in the Cluster_39 area (7 symbols) | `.claude/skills/generated/cluster-39/SKILL.md` |
| Work in the Cluster_31 area (6 symbols) | `.claude/skills/generated/cluster-31/SKILL.md` |
| Work in the Log area (6 symbols) | `.claude/skills/generated/log/SKILL.md` |
| Work in the Get area (6 symbols) | `.claude/skills/generated/get/SKILL.md` |
| Work in the Cluster_13 area (5 symbols) | `.claude/skills/generated/cluster-13/SKILL.md` |

<!-- gitnexus:end -->

## Butler SOS — Agent Guide

## GitNexus index freshness — handled by git hooks, not by you

The index is re-generated automatically by git hooks; you should not normally need to
re-index by hand. One-time setup per clone: `npm run gitnexus:install`.

**Never run a bare `npx gitnexus analyze`**, including where the generated GitNexus block in
`CLAUDE.md` / `AGENTS.md` suggests it. It rewrites that managed block and, without `--skills`,
deletes the generated-skills table from both files. Re-index only through the
`npm run gitnexus:*` scripts, which reach GitNexus through `scripts/gitnexus.js` and pass
`--skip-agents-md`. Other subcommands (`impact`, `context`, `query`, `detect-changes`) are
read-only and safe to run directly.

See `docs/README.gitnexus.md` for the hooks, the full command table and version pinning.

## Ask before building when the goal is unclear

**Ask up to four clarifying questions before starting** whenever anything about the intended
goal, the requirements, which files to touch, or the existing conventions is ambiguous. Ask them
up front, together, not one at a time mid-task.

Ambiguous means two readings would lead to materially different work. It does not mean every
judgement call — if the repo, the code or an obvious default settles it, settle it and say which
way you went. The test is whether being wrong would waste the work.

Ask especially about **what the change is meant to prevent or achieve**, not just what to build.
A task framed only as an implementation invites verification that confirms the code does what it
says, rather than that it solves the problem — which is how a change can pass every check and
still miss the point.

## Git workflow

- **Branch names MUST be prefixed with `claude/`.** When creating a branch for ongoing work,
  name it `claude/<short-description>` — e.g. `claude/fix-udp-source-validation`. This keeps
  agent-created branches clearly namespaced and easy to filter or bulk-clean.
- Never commit directly to `master` — branch first, then open a PR
- Conventional Commits required; release-please derives the changelog and version bump from
  the commit type. Sections defined in `release-please-config.json`: `feat`, `fix`, `chore`,
  `refactor`, `docs`, `build`, `test`

## Doc site staging — `docs/to-doc-site`

User-visible changes must be documented in `docs/to-doc-site`, in the same PR as the code
change — otherwise the change ships and the doc site never learns about it. That covers new
or changed features, config settings, bug fixes an administrator would notice, and new log
messages or status codes an operator might search for.

Skip it for changes with no admin-visible effect: internal refactors, test-only changes,
CI/tooling, and dependency bumps.

**Read `docs/to-doc-site/README.md` before writing.** It is the single source of truth for
when a file is required, who the audience is, and how the file must be named and structured.

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

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:
- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.
