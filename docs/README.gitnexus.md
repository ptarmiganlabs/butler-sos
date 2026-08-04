# README.gitnexus.md

This file provides guidance about the GitNexus code-intelligence index in this repository — how
it is kept current, which commands to use, and which command not to use.

This repo is indexed in GitNexus as `butler-sos`. In a multi-repo workspace, include
`-r butler-sos` on GitNexus CLI commands so they resolve to this repository.

## One-time setup

GitNexus is fetched once, deliberately:

```bash
npm run gitnexus:install
```

Until this has been run the git hooks below are inert — they print a one-line notice and exit
without doing anything.

## The index is kept current by git hooks

`.husky/` installs `post-commit`, `post-merge`, `post-rewrite` and `post-checkout` hooks, all of
which run `.husky/gitnexus-reindex.sh`. Between them they cover every routine way the working
tree changes: committing, pulling and merging, rebasing or amending, and switching branches.
You should not normally need to re-index by hand.

The re-index is incremental and runs synchronously, taking roughly two seconds. It never blocks
a git operation — every failure path exits 0:

- No `.gitnexus` directory in the checkout: a full build is too slow for a hook, so it prints a
  notice pointing at `npm run gitnexus:refresh` and stops.
- GitNexus not installed: prints a notice pointing at `npm run gitnexus:install` and stops.
- Write fails: retried once after a short pause. The KuzuDB index is held open by the GitNexus
  MCP server while an agent session is running, and a write from a hook can lose that lock race.
  If the second attempt also fails it says so and suggests running `npm run gitnexus:index`.

`post-checkout` additionally skips file checkouts (`git checkout -- <file>`) and no-op branch
checkouts, which would otherwise re-index for nothing.

## Commands

| Command | Use for |
|---------|---------|
| `npm run gitnexus:install` | One-time setup. Fetches the pinned GitNexus; the hooks are inert until this has been run |
| `npm run gitnexus:status` | Check whether the index is current |
| `npm run gitnexus:index` | Incremental re-index (same as the hooks) |
| `npm run gitnexus:refresh` | Full refresh incl. embeddings and regenerated skill files |

## Never run a bare `npx gitnexus analyze`

Always go through the `npm run gitnexus:*` scripts. They pass `--skip-agents-md`, which stops
GitNexus rewriting the managed block bracketed by `<!-- gitnexus:start -->` and
`<!-- gitnexus:end -->` in `CLAUDE.md` and `AGENTS.md`.

A bare `analyze` rewrites that block, and without `--skills` it does not merely regenerate it but
*reduces* it — a bare run has already deleted all 20 rows of the generated-skills table from both
files at once. Both files also carry hand-written sections below the managed block, so this is
not a harmless regeneration.

The generated skill files under `.claude/skills/` are rewritten by the same mechanism.
`.claude/skills/gitnexus/*/SKILL.md` is additionally gitignored. Neither location is a safe place
for hand-written content.

`gitnexus:refresh` is the only script that regenerates embeddings and skill files; a plain
`analyze` preserves any embeddings already in the index.

## Why GitNexus is not a devDependency

GitNexus is ~40 MB unpacked with native tree-sitter builds — too much to add to every CI install
for what is a local developer convenience.

Everything except `gitnexus:install` uses `npx --no-install`, so it runs an already-present copy
and never fetches one. `npx --yes` would download a package on demand and run its lifecycle
scripts; doing that automatically after every commit would turn routine git activity into a
package install from the network (SonarCloud `shell:S6505`). `gitnexus:install` is the single
place `--yes` appears, and it is only ever invoked by hand.

## Version pinning

The pinned version lives in **two places that must stay in sync**:

- `GITNEXUS_VERSION` in `.husky/gitnexus-reindex.sh`
- the `gitnexus:*` scripts in `package.json`

Read the current version from either of those, not from here — a version number repeated in prose
is a third copy waiting to go stale.

The pin is deliberate: the hooks run automatically after routine git operations, so an unpinned
`npx gitnexus` would execute whatever the registry serves at that moment — a new major, or a
compromised release — with no repository change and no review.
