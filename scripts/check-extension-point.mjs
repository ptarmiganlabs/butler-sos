#!/usr/bin/env node
// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js

/**
 * Refuse a commit that adds an unlisted file under `src/lib/extensions/`.
 *
 * That directory is not ordinary source. It is the one place the build substitutes at bundle time:
 * `EXTENSIONS_MODULE` makes `#extensions` resolve somewhere else entirely, and the committed
 * default is what every build in this repository uses instead.
 *
 * So a file added beside the default is one of two things, and neither is casual. Either it is
 * contract surface, which needs the versioning and the coordinated change the extension contract
 * describes - or it is something an override build half-replaces, because the module behind
 * `#extensions` then comes from elsewhere while this file still comes from core, and the two
 * disagree about what the seam is.
 *
 * An **allowlist**, not a pattern, and deliberately so. A denylist fails silently and later:
 * someone adds a file in a year, no rule mentions it, and nothing says a word. An allowlist fails
 * closed - a new file is refused until somebody edits the list, which is exactly the moment the
 * decision is being made. The contract expects this directory to change rarely, so the cost is a
 * one-line edit at the point of a deliberate change.
 *
 * The ESLint rule in `eslint.config.js` is the other half of the same boundary and cannot cover
 * this one: lint sees imports, and a file nobody imports yet is still contract surface.
 *
 * `.gitignore` is not an option either. A trailing-slash pattern does not match a symlink of that
 * name, and an ignored path is still committable with `git add -f`. This inspects what is actually
 * staged, so `-f` makes no difference.
 *
 * Usage:
 *   node scripts/check-extension-point.mjs <path>...
 *
 * Invoked by pre-commit with the staged paths under that directory. With no arguments it checks
 * every file currently in the directory, which is what the test uses.
 */

import { readdirSync } from 'node:fs';

const DIRECTORY = 'src/lib/extensions';

/**
 * Every file allowed to live under the extension point, by exact path.
 *
 * Adding to this list is the deliberate act the guard exists to require. Before doing so, be sure
 * the file belongs in core rather than behind the seam: anything a variant build supplies belongs
 * in that build's own module, not here.
 */
const ALLOWED = new Set([
    'src/lib/extensions/index.js',
    'src/lib/extensions/apply.js',
    'src/lib/extensions/version.js',
    'src/lib/extensions/__tests__/apply.test.js',
    'src/lib/extensions/__tests__/extensions.test.js',
]);

/**
 * Every file currently under the directory, as repo-relative forward-slash paths.
 *
 * @returns {string[]} Paths, in no particular order.
 */
const filesUnder = () =>
    readdirSync(DIRECTORY, { recursive: true, withFileTypes: true })
        .filter((entry) => !entry.isDirectory())
        .map((entry) => normalise(`${entry.parentPath}/${entry.name}`));

/**
 * A path with forward slashes only. Git hands over forward-slash paths; Windows path handling does
 * not, so both are compared one way.
 *
 * @param {string} path - A path, with either separator.
 *
 * @returns {string} The same path with forward slashes.
 */
const normalise = (path) => path.split('\\').join('/');

/**
 * Whether a path is the extension point or something inside it.
 *
 * The directory **itself** counts, not only its contents. A trailing-slash test alone would let
 * through the one shape this guard most needs to catch: the whole directory replaced by a symlink,
 * which git stages as the single path `src/lib/extensions` with nothing after it. That is the same
 * trailing-slash blind spot that rules `.gitignore` out as a control here.
 *
 * @param {string} path - A repo-relative, forward-slash path.
 *
 * @returns {boolean} True when the path is at or below the extension point.
 */
const isInDirectory = (path) => path === DIRECTORY || path.startsWith(`${DIRECTORY}/`);

const supplied = process.argv.slice(2).map(normalise);

// With no arguments the whole directory is the subject, so the allowlist can be checked in both
// directions. With staged paths it cannot: git hands over only what changed, and every file left
// untouched would look missing.
const walkingWholeDirectory = supplied.length === 0;
const candidates = walkingWholeDirectory ? filesUnder() : supplied;

const unlisted = candidates.filter((path) => isInDirectory(path) && !ALLOWED.has(path));
const missing = walkingWholeDirectory
    ? [...ALLOWED].filter((path) => !candidates.includes(path))
    : [];

if (missing.length > 0) {
    console.error(`\n${DIRECTORY}/ is missing files its allowlist says belong there:\n`);

    for (const path of missing) {
        console.error(`  ${path}`);
    }

    console.error(
        '\nEither the file was removed without updating ALLOWED in scripts/check-extension-point.mjs,\nor the removal was not intended.\n'
    );

    process.exitCode = 1;
}

if (unlisted.length > 0) {
    console.error(
        `\n${DIRECTORY}/ is a build seam, not an ordinary source directory, and these files are not on its allowlist:\n`
    );

    for (const path of unlisted) {
        console.error(`  ${path}`);
    }

    console.error(
        [
            '',
            'The build can substitute what this directory resolves to, so a file added here is either',
            'contract surface that needs versioning, or something an override build half-replaces.',
            '',
            'If the file genuinely belongs in core, add its exact path to ALLOWED in',
            'scripts/check-extension-point.mjs, in the same commit and on purpose.',
            'If it belongs to a build that supplies its own extensions module, it belongs there instead.',
            '',
        ].join('\n')
    );

    process.exitCode = 1;
}
