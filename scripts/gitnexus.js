#!/usr/bin/env node
// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js

/**
 * Single entry point for every GitNexus invocation in this repository.
 *
 * The pinned version and the analyze flags are defined here exactly once. The
 * `gitnexus:*` npm scripts and the git hook in `.husky/gitnexus-reindex.sh` all route
 * through this file, so there is no second copy of either to keep in sync.
 *
 * Run via: npm run gitnexus:install | gitnexus:status | gitnexus:index | gitnexus:refresh
 *
 * Extra arguments are forwarded to gitnexus, so `npm run gitnexus:index -- --embeddings`
 * behaves as it did before this wrapper existed.
 */

import { spawnSync } from 'node:child_process';

/**
 * Pinned deliberately.
 *
 * The git hook runs automatically after routine git operations, so an unpinned
 * `npx gitnexus` would execute whatever the registry serves at that moment — a new
 * major, or a compromised release — with no repository change and no review.
 *
 * This constant is the only place the version appears. Bumping it here updates the
 * hook and every npm script at once.
 */
const GITNEXUS_VERSION = '1.6.9';

/**
 * Flags shared by every `analyze` run.
 *
 * `--skip-agents-md` is load-bearing, not cosmetic: it stops gitnexus rewriting the
 * managed block in CLAUDE.md and AGENTS.md. Both files also carry hand-written
 * sections, and without `--skills` the generated block is not merely regenerated but
 * *reduced* — a bare `analyze` once deleted all 20 rows of the generated-skills table
 * from both files. `--no-stats` is belt-and-braces for the same reason.
 */
const ANALYZE_FLAGS = ['--no-stats', '--skip-agents-md'];

/**
 * Subcommands, and how each maps onto a gitnexus invocation.
 *
 * `fetch` marks the one command allowed to download the package. Everything else runs
 * under `npx --no-install`, which executes an already-present copy and never fetches
 * one: a hook that downloaded and ran a package after every commit would be a
 * supply-chain surface (SonarCloud shell:S6505). GitNexus is deliberately not a
 * devDependency — ~40 MB unpacked with native tree-sitter builds is too much to add to
 * every CI install for a local developer tool — so `install` is the one deliberate,
 * human-invoked fetch.
 *
 * `index` omits `--embeddings` because that is the slow part, and a plain analyze
 * preserves any embeddings already in the index. `refresh` regenerates them together
 * with the generated skill files.
 *
 * `check` is used by the git hook to detect a missing install without printing
 * anything; it reports the result through its exit code alone.
 */
const COMMANDS = {
    install: { args: ['--version'], fetch: true },
    check: { args: ['--version'], quiet: true },
    status: { args: ['status'] },
    index: { args: ['analyze', ...ANALYZE_FLAGS] },
    refresh: { args: ['analyze', ...ANALYZE_FLAGS, '--embeddings', '--skills'] },
};

/**
 * Resolves the subcommand and runs it.
 *
 * Returns the exit code rather than calling process.exit() itself — see the note at
 * the bottom of the file for why that distinction matters.
 *
 * @returns {number} Exit code to report to the shell.
 */
function main() {
    // Anything after the subcommand is forwarded to gitnexus untouched, so
    // `npm run gitnexus:index -- --embeddings` keeps working the way it did when the npm
    // scripts called npx directly. Dropping these silently would leave the caller
    // believing a flag took effect when it never reached the tool.
    const [, , name, ...passthrough] = process.argv;
    const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;

    if (!command) {
        console.error(
            `Usage: node scripts/gitnexus.js <${Object.keys(COMMANDS).join('|')}> [...args]`
        );
        return 1;
    }

    // npx is a .cmd shim on Windows and spawn() will not find it without the extension.
    // Resolving it here keeps `shell: true` — and the quoting hazards that come with it —
    // out of the picture.
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const result = spawnSync(
        npx,
        [
            command.fetch ? '--yes' : '--no-install',
            `gitnexus@${GITNEXUS_VERSION}`,
            ...command.args,
            ...passthrough,
        ],
        { stdio: command.quiet ? 'ignore' : 'inherit' }
    );

    if (result.error) {
        if (!command.quiet) {
            console.error(`gitnexus: could not run npx: ${result.error.message}`);
        }
        return 1;
    }

    // null status means the child was killed by a signal; treat that as a failure.
    return result.status ?? 1;
}

// Setting exitCode lets Node exit on its own once stderr has drained. process.exit()
// terminates before pending asynchronous stdio writes complete, and writes to a pipe
// are asynchronous while writes to a TTY are not — so the messages above would survive
// an interactive run and could be lost under `... 2>&1 | tee log` or on a CI runner.
process.exitCode = main();
