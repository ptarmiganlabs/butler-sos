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

The index above is re-generated automatically. `.husky/` installs `post-commit`, `post-merge`,
`post-rewrite` and `post-checkout` hooks that all run `.husky/gitnexus-reindex.sh` — an
incremental re-index taking ~2s that never blocks a git operation. You should not normally need
to re-index by hand.

**Ignore the "run `npx gitnexus analyze`" line in the generated block above — it is wrong here.**
A bare `analyze` rewrites the managed block, and without `--skills` it *deletes* the whole
generated-skills table from this file and from `CLAUDE.md`. Use the npm scripts instead, which
pass `--skip-agents-md`:

| Command | Use for |
|---------|---------|
| `npm run gitnexus:install` | One-time setup. Fetches the pinned GitNexus; the hooks are inert until this has been run |
| `npm run gitnexus:status` | Check whether the index is current |
| `npm run gitnexus:index` | Incremental re-index (same as the hooks) |
| `npm run gitnexus:refresh` | Full refresh incl. embeddings and regenerated skill files |

GitNexus is intentionally **not** a devDependency — it is ~40 MB unpacked with native
tree-sitter builds, too much to add to every CI install for a local developer tool. The
wrapper described below runs everything except `gitnexus:install` under `npx --no-install`,
so it can run an already-present copy but never fetch one; a hook that downloaded and
executed a package after every commit would be a supply-chain surface. If the hooks report
that GitNexus is not installed, run `npm run gitnexus:install` once.

The pinned version is defined once, as `GITNEXUS_VERSION` in `scripts/gitnexus.js`. The
`gitnexus:*` npm scripts and the git hook both invoke that wrapper instead of calling `npx`
themselves, so bumping the version there updates every caller — there is no second copy to
keep in sync. The wrapper also owns the `analyze` flags, including the `--skip-agents-md`
that stops a re-index deleting the generated-skills table from this file.

## Git workflow

- **Branch names MUST be prefixed with `claude/`.** When creating a branch for ongoing work,
  name it `claude/<short-description>` — e.g. `claude/fix-udp-source-validation`. This keeps
  agent-created branches clearly namespaced and easy to filter or bulk-clean.
- Never commit directly to `master` — branch first, then open a PR
- Conventional Commits required; release-please derives the changelog and version bump from
  the commit type. Sections defined in `release-please-config.json`: `feat`, `fix`, `chore`,
  `refactor`, `docs`, `build`, `test`

## Doc site staging — `docs/to-doc-site`

The doc site is a separate repo that takes its input from `docs/to-doc-site`. Capture
admin-facing changes there **in the same PR as the code change**.

- **Write a file for**: new features, changed behaviour, new/renamed/removed/re-defaulted
  config settings, bug fixes an admin would notice, new log messages or status codes an
  operator might search for, anything affecting an upgrade
- **Skip**: internal refactors, test-only changes, CI/tooling, dependency bumps with no
  behaviour change
- **Read `docs/to-doc-site/README.md` first** — it owns the rules on audience, format and
  naming. Most-missed points: the audience is Qlik Sense admins, *not* developers (no code
  snippets, no `src/` paths, no internal symbol names), and each file is self-contained
- See `docs/to-doc-site/audit-api-rate-limiting.md` for expected depth and structure
- Never add the `done_` prefix — that is applied when the content reaches the doc site

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
