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

## GitNexus index freshness — handled by git hooks, not by you

The index above is re-generated automatically. `.husky/` installs `post-commit`, `post-merge`,
`post-rewrite` and `post-checkout` hooks that all run `.husky/gitnexus-reindex.sh` — an
incremental re-index taking ~2s that never blocks a git operation. You should not normally need
to re-index by hand.

**Ignore the "run `npx gitnexus analyze`" line in the generated block above — it is wrong here.**
A bare `analyze` rewrites the managed block, and without `--skills` it *deletes* the whole
generated-skills table from this file and from `AGENTS.md`. Use the npm scripts instead, which
pass `--skip-agents-md`:

| Command | Use for |
|---------|---------|
| `npm run gitnexus:install` | One-time setup. Fetches the pinned GitNexus; the hooks are inert until this has been run |
| `npm run gitnexus:status` | Check whether the index is current |
| `npm run gitnexus:index` | Incremental re-index (same as the hooks) |
| `npm run gitnexus:refresh` | Full refresh incl. embeddings and regenerated skill files |

GitNexus is intentionally **not** a devDependency — it is ~40 MB unpacked with native
tree-sitter builds, too much to add to every CI install for a local developer tool. Everything
except `gitnexus:install` uses `npx --no-install`, so it can run an already-present copy but
never fetch one; a hook that downloaded and executed a package after every commit would be a
supply-chain surface. If the hooks report that GitNexus is not installed, run
`npm run gitnexus:install` once.

The pinned version lives in two places that must stay in sync: `GITNEXUS_VERSION` in
`.husky/gitnexus-reindex.sh` and the `gitnexus:*` scripts in `package.json`.

## Git workflow

- **Branch names MUST be prefixed with `claude/`.** When creating a branch for ongoing work,
  name it `claude/<short-description>` — for example `claude/fix-udp-source-validation` or
  `claude/add-influxdb-v3-retry`. This keeps agent-created branches clearly namespaced and
  easy to filter or bulk-clean.
- Never commit directly to `master`. Branch first, then open a PR.
- Commits follow Conventional Commits — release-please derives the changelog and version bump
  from the commit type. Types with a changelog section are defined in
  `release-please-config.json`: `feat`, `fix`, `chore`, `refactor`, `docs`, `build`, `test`.

## Doc site staging — `docs/to-doc-site`

The Butler SOS documentation site lives in a separate repo and takes its input from
`docs/to-doc-site`. Anything an administrator would need to know about must be captured
there, in the same PR as the code change — otherwise the change ships and the doc site
never learns about it.

**Write a file when the change is user-visible**, including:

- a new feature, or a change to how an existing one behaves
- a new, renamed, removed or re-defaulted config setting
- a bug fix an admin would notice (wrong data, a silent failure that now surfaces)
- new or changed log messages, error codes or HTTP status codes an operator might search for
- anything that changes what an admin must do when upgrading

**Do not write a file** for changes with no admin-visible effect: internal refactors,
test-only changes, CI/tooling, or dependency bumps that change no behaviour.

**Read `docs/to-doc-site/README.md` before writing** — it is the authority on audience,
file format and naming, and this section deliberately does not restate its rules. The two
things most often got wrong:

- The audience is **Qlik Sense administrators, not Node.js developers**. Do not include code
  snippets, internal function or variable names, or paths inside `src/`.
- Each file is self-contained. One topic per file, kebab-case name, no cross-references to
  other staging files.

`docs/to-doc-site/audit-api-rate-limiting.md` is a good worked example of the expected depth
and structure. Never add the `done_` prefix yourself — that is applied by whoever migrates
the content to the doc site.

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:
- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.
