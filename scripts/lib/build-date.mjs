// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js, git

/**
 * The date `scripts/bundle.mjs` stamps into every binary, and where it comes from.
 *
 * A module of its own so that it can be tested: `bundle.mjs` runs its command line as soon as it is
 * loaded, so nothing in it can be imported by a test. That matters: one git setting is enough to
 * make the date quietly come from the clock, and only a test can say so (see `commitEpochSeconds`).
 */

import { spawnSync } from 'node:child_process';

/**
 * Seconds since the epoch, if the string is a plain non-negative integer.
 *
 * Deliberately strict. `SOURCE_DATE_EPOCH` is an integer by specification, and `Number('')` is 0
 * while `Number('   ')` is also 0 - so a loose parse would silently date every binary 1970-01-01
 * rather than falling through to something usable.
 *
 * @param {string|undefined} value - The candidate.
 *
 * @returns {number|undefined} The seconds, or undefined when it is not a usable integer.
 */
export const epochSeconds = (value) => {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
        return undefined;
    }

    const seconds = Number(value.trim());

    return Number.isSafeInteger(seconds) ? seconds : undefined;
};

/**
 * The commit this tree is at, as seconds since the epoch.
 *
 * `--no-show-signature`, because `log.showSignature` - a setting people who sign their own commits
 * often turn on - makes `git log` print gpg's verification of a signed commit ahead of the format
 * output. Every merge made through GitHub's web UI is signed, so `HEAD` on `master` usually is, and
 * the setting alone is enough: no key and no signing of one's own. The output is then not an
 * integer, `epochSeconds` rightly refuses it, and the build falls back to the clock - not
 * reproducible, and nothing says so.
 *
 * @param {string} [cwd] - The checkout to ask. Defaults to the current directory, where the bundler
 *     runs.
 * @param {(command: string, args: string[], options: object) => {status: number, stdout: string}} [run] -
 *     How to run git. Injectable for tests.
 *
 * @returns {number|undefined} The committer date, or undefined outside a usable git checkout.
 */
export const commitEpochSeconds = (cwd = process.cwd(), run = spawnSync) => {
    const result = run('git', ['log', '-1', '--no-show-signature', '--format=%ct'], {
        cwd,
        encoding: 'utf8',
    });

    return result.status === 0 ? epochSeconds(String(result.stdout)) : undefined;
};

/**
 * The date stamped into every binary, as ISO yyyy-mm-dd in UTC.
 *
 * A date rather than a timestamp: it answers "roughly when did this come from?", and a
 * to-the-second value would make two builds of the same commit differ for no reader's benefit.
 *
 * **It is derived, not read off the clock, so that a build stays reproducible.** Stamping
 * `new Date()` meant two builds of the same commit on different days produced different bytes -
 * which quietly cost the project the ability to rebuild a published binary and compare it, the
 * check that distinguishes a benign difference from a tampered artifact. Three sources, in order:
 *
 * 1. **`SOURCE_DATE_EPOCH`**, the cross-ecosystem convention for exactly this. An explicit value
 *    wins, so a caller reproducing an old build can name its date.
 * 2. **The committer date of `HEAD`**, which makes every build of a given commit identical without
 *    anyone configuring anything - including the release jobs, which build from a checkout.
 * 3. **The wall clock**, only when neither is available: an exported tarball with no `.git` and no
 *    environment variable. Such a build is not reproducible, and nothing here can make it so.
 *
 * @param {object} [context] - Where to look. Every field defaults to this process's own.
 * @param {object} [context.env] - The environment to read `SOURCE_DATE_EPOCH` from.
 * @param {string} [context.cwd] - The checkout whose `HEAD` dates the build.
 * @param {number} [context.now] - The clock, in milliseconds since the epoch.
 * @param {(command: string, args: string[], options: object) => {status: number, stdout: string}} [context.run] -
 *     How to run git. Injectable for tests.
 *
 * @returns {string} The date, in UTC.
 */
export const buildDate = ({ env = process.env, cwd, now = Date.now(), run } = {}) => {
    const seconds = epochSeconds(env.SOURCE_DATE_EPOCH) ?? commitEpochSeconds(cwd, run);

    return new Date((seconds ?? now / 1000) * 1000).toISOString().slice(0, 10);
};
