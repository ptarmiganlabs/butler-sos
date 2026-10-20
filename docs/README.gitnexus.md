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

### The one install script GitNexus needs

npm 12 blocks the install scripts of dependencies by default. One dependency of GitNexus needs its
script: `@ladybugdb/core`, the graph database, whose script copies the prebuilt native binary for
your platform (`lbugjs.node`) out of a per-platform sub-package into place.
`npm run gitnexus:install` therefore passes `--allow-scripts=@ladybugdb/core` on its `npx`
command, and allows no other script.

Without that binary the install looks healthy. `gitnexus:install` still succeeds, and so do
`npm run gitnexus:status` and the hooks' check for an install, because none of them opens the
database. Everything that does open it fails with
`LadybugDB native binary (lbugjs.node) is missing`: `npm run gitnexus:index`,
`npm run gitnexus:refresh`, and the hooks' re-index — whose output the hooks discard, so all they
report is `index refresh failed twice`.

The grant is made on that one `npx` command and nowhere else:

- **Not on the other commands.** npm runs install scripts only while it installs, and every other
  command runs `npx --no-install`.
- **Not in `.npmrc`**, this repository's or your own. `npm run` hands `.npmrc` settings to
  everything it starts as `npm_config_*` environment variables, and npm 12 refuses `allow-scripts`
  from the environment in project commands such as `npm audit` and `npm ci`. `npm run deps:audit`
  would then fail with `EALLOWSCRIPTS`, because `audit-ci` runs `npm audit`.
- **Not in `package.json`.** `npx` ignores the `allowScripts` field by design, so it would never
  reach this install.

Under npm 11 the flag changes nothing: npm 11 runs every install script regardless, and its older
releases only warn that they do not recognise the flag.

The other install scripts in GitNexus's dependency tree stay blocked, and none of them is needed:

- **The tree-sitter parser and grammars**, including the ones GitNexus vendors itself, ship
  prebuilt binaries that are loaded at runtime. Their scripts compile from source only where no
  prebuilt binary exists, which also takes a C/C++ toolchain.
- **`onnxruntime-node`**, the embeddings runtime behind `gitnexus:refresh`, bundles its CPU
  binaries. Its script downloads CUDA GPU libraries on Linux x64 and does nothing elsewhere;
  without those libraries GitNexus computes embeddings on the CPU. `gitnexus:refresh` therefore
  works without adding `onnxruntime-node` to the grant.
- **`@scarf/scarf`** reports the install to an analytics service, and **`protobufjs`** checks the
  version ranges its dependents use.

### Repairing an install made without the binary

A GitNexus installed under npm 12 without the grant — by `gitnexus:install` before it passed one,
or by a plain `npx` — has no binary, and running `npm run gitnexus:install` again does not add it.
npx keeps one cache folder per package spec under `~/.npm/_npx/` and reuses it whenever it already
holds the pinned version, so npm never installs into it again, and install scripts only ever run
while npm installs.

Start by finding that folder. The error from `npm run gitnexus:index` prints a repair command that
includes its path. Alternatively, list every npx folder that holds a GitNexus, with the version
each one holds:

```bash
grep -H '"gitnexus@' "$(npm config get cache)"/_npx/*/package.json
```

Take the folder holding the version in `GITNEXUS_VERSION`. Then either run the script npm skipped:

```bash
node <folder>/node_modules/@ladybugdb/core/install.js
```

or delete that one folder and install again, which now runs the script:

```bash
rm -rf <folder>
npm run gitnexus:install
```

Either way, confirm with `npm run gitnexus:index` rather than `gitnexus:status`, which succeeds
with or without the binary. The hooks pick up the repaired install on their own.

## The index is kept current by git hooks

`.husky/` installs `post-commit`, `post-merge`, `post-rewrite` and `post-checkout` hooks, all of
which run `.husky/gitnexus-reindex.sh`. Between them they cover every routine way the working
tree changes: committing, pulling and merging, rebasing or amending, and switching branches.
You should not normally need to re-index by hand.

The re-index is incremental and runs synchronously, taking roughly two seconds. It never blocks
a git operation — every failure path exits 0:

- No `.gitnexus` directory in the checkout: a full build is too slow for a hook, so it prints a
  notice pointing at `npm run gitnexus:refresh` and stops.
- No `node` or no `npx` on `PATH`: exits silently, because such an environment cannot act on any
  advice the hook could print.
- `scripts/gitnexus.js` not present in the checkout: prints a notice saying so and stops. Every
  commit made before the wrapper existed is such a checkout, and `post-checkout` fires on exactly
  those — this is deliberately *not* reported as GitNexus being missing, because
  `npm run gitnexus:install` would not fix it.
- GitNexus not installed: prints a notice pointing at `npm run gitnexus:install` and stops.
- Write fails: retried once after a short pause. The KuzuDB index is held open by the GitNexus
  MCP server while an agent session is running, and a write from a hook can lose that lock race.
  If the second attempt also fails it says so and suggests running `npm run gitnexus:index`.
  An install without its database binary fails the same way, every time; see
  [Repairing an install made without the binary](#repairing-an-install-made-without-the-binary).

`post-checkout` additionally skips file checkouts (`git checkout -- <file>`) and no-op branch
checkouts, which would otherwise re-index for nothing.

## Commands

| Command | Use for |
|---------|---------|
| `npm run gitnexus:install` | One-time setup. Fetches the pinned GitNexus; the hooks are inert until this has been run |
| `npm run gitnexus:status` | Check whether the index is current |
| `npm run gitnexus:index` | Incremental re-index (same as the hooks) |
| `npm run gitnexus:refresh` | Full refresh incl. embeddings and regenerated skill files |

Arguments after the script name are forwarded to GitNexus, so
`npm run gitnexus:index -- --embeddings` works.

## Everything routes through `scripts/gitnexus.js`

None of the commands above invoke `npx` themselves, and neither does the git hook. All of them
run `scripts/gitnexus.js`, which owns the pinned version, the `analyze` flags and the `npx`
invocation. That is what keeps the version in one place rather than in every caller, and it is
where to look when a command behaves unexpectedly.

## Never run a bare `npx gitnexus analyze`

Always go through the `npm run gitnexus:*` scripts. The wrapper passes `--skip-agents-md`, which
stops GitNexus rewriting the managed block bracketed by `<!-- gitnexus:start -->` and
`<!-- gitnexus:end -->` in `CLAUDE.md` and `AGENTS.md`, and `--skip-skills`, which stops it
installing its standard skill files over the ones in `.claude/skills/`.

A bare `analyze` rewrites that block, and without `--skills` it does not merely regenerate it but
*reduces* it — a bare run has already deleted all 20 rows of the generated-skills table from both
files at once. Both files also carry hand-written sections below the managed block, so this is
not a harmless regeneration.

The generated skill files under `.claude/skills/` are rewritten by the same mechanism.
`.claude/skills/gitnexus/*/SKILL.md` is additionally gitignored. Neither location is a safe place
for hand-written content.

`--skip-agents-md` does not cover GitNexus's standard skill files, so the two flags are needed
together. Without `--skip-skills`, `analyze` writes its own copies of those skills straight under
`.claude/skills/` and deletes the tracked copy in `.claude/skills/gitnexus/` of every skill
nobody has edited. Through the git hook, that would happen after every commit.

`gitnexus:refresh` is the only script that regenerates embeddings and skill files; a plain
`analyze` preserves any embeddings already in the index.

## Why GitNexus is not a devDependency

GitNexus is ~40 MB unpacked with native tree-sitter builds — too much to add to every CI install
for what is a local developer convenience.

For every command except `gitnexus:install`, the wrapper invokes `npx --no-install`, so it runs
an already-present copy and never fetches one. `npx --yes` would download a package on demand and
run its lifecycle scripts; doing that automatically after every commit would turn routine git
activity into a package install from the network (SonarCloud `shell:S6505`). `install` is the
single command that passes `--yes`, and it is only ever invoked by hand.

## Version pinning

The pinned version is defined in **exactly one place**: `GITNEXUS_VERSION` in
`scripts/gitnexus.js`. Every npm script and the git hook reach GitNexus through that wrapper, so
changing the constant there updates all of them at once.

After changing it, run `npm run gitnexus:install` and then `npm run gitnexus:index`. A new
version gets a fresh npx cache folder, so the install runs for real, and `gitnexus:index` is the
check that counts — `gitnexus:status` succeeds even when the database cannot load. If the new
version brings another dependency that needs its install script, this is where it shows: add that
package to `ALLOW_SCRIPTS` in the wrapper, next to `@ladybugdb/core`, then reinstall as described
under [Repairing an install made without the binary](#repairing-an-install-made-without-the-binary),
because the folder the first attempt filled is reused as it is.

Read the current version from that constant, not from here — a version number repeated in prose
is a second copy waiting to go stale. For the same reason, do not reintroduce the version into
`package.json` or the hook: `scripts/__tests__/gitnexus-wrapper.test.js` fails if a second copy
appears, or if any caller stops going through the wrapper.

The pin is deliberate: the hooks run automatically after routine git operations, so an unpinned
`npx gitnexus` would execute whatever the registry serves at that moment — a new major, or a
compromised release — with no repository change and no review.
