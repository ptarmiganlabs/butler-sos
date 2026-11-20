import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Behavioural, deliberately. A test of the config's *shape* cannot see the failure that matters most
// here: flat config replaces a rule's options rather than merging them, so a second block naming
// `no-restricted-imports` for the same files silently switches the first one off. These tests run
// the real config over real source text instead.
//
// ESLint runs in a child process rather than through its Node API: the config loads
// eslint-config-prettier through FlatCompat, which `require`s an ES module, and Jest's module
// runtime refuses that.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ESLINT = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');

/**
 * Lint a snippet as if it were a file at `filePath`, and return the rules that fired.
 *
 * @param {string} code - Source to lint.
 * @param {string} filePath - Repo-relative path to attribute it to, since the rules are path-scoped.
 *     Passed through as given, forward slashes and all: the config scopes its rules with
 *     forward-slash globs like `src/**\/*.js`.
 *
 * @returns {Array<{ruleId: string, message: string}>} One entry per message.
 */
const rulesFiredFor = (code, filePath) => {
    const result = spawnSync(
        process.execPath,
        [ESLINT, '--format', 'json', '--stdin', '--stdin-filename', filePath],
        { cwd: repoRoot, input: code, encoding: 'utf8' }
    );
    const [report] = JSON.parse(result.stdout);

    return report.messages.map(({ ruleId, message }) => ({ ruleId, message }));
};

/**
 * Whether a rule fired, and the message it carried.
 *
 * @param {Array<{ruleId: string, message: string}>} fired - What lint reported.
 * @param {string} ruleId - The rule to look for.
 *
 * @returns {{fired: boolean, message: string}} Whether it fired, and the first message if so.
 */
const forRule = (fired, ruleId) => {
    const hit = fired.find((entry) => entry.ruleId === ruleId);

    return { fired: Boolean(hit), message: hit?.message ?? '' };
};

describe('the extension-point boundary', () => {
    test.each([
        [
            'a relative import of the module',
            "import { extensions } from './lib/extensions/index.js';",
        ],
        ['a deeper relative import', "import { extensions } from '../extensions/index.js';"],
        ['reaching into a subdirectory', "import helper from '../extensions/subdir/helper.js';"],
    ])('rejects %s', async (_name, code) => {
        const { fired, message } = forRule(
            rulesFiredFor(code, 'src/lib/probe.js'),
            'no-restricted-imports'
        );

        expect(fired).toBe(true);
        expect(message).toContain('#extensions');
    });

    // no-restricted-imports does not reach a dynamic import, which is why the config carries a
    // second selector for it. Both alternatives of the selector, because they are separately
    // fragile: the second embeds a raw `/` inside a character class within an esquery attribute
    // regex, and nothing but a test would notice if a future esquery parsed that differently.
    test.each([
        [
            'the module itself',
            "export const load = async () => import('./lib/extensions/index.js');",
        ],
        [
            'a subdirectory of it',
            "export const load = async () => import('../extensions/subdir/helper.js');",
        ],
    ])('rejects a dynamic import of %s', async (_name, code) => {
        const { fired, message } = forRule(
            rulesFiredFor(code, 'src/lib/probe.js'),
            'no-restricted-syntax'
        );

        expect(fired).toBe(true);
        expect(message).toContain('#extensions');
    });

    test.each([
        ['the specifier itself', "import { extensions } from '#extensions';"],
        [
            'the core-side helper beside it',
            "import { applyOptions } from './lib/extensions/apply.js';",
        ],
        ['the version module', "import { SEAM_VERSION } from './lib/extensions/version.js';"],
    ])('allows %s', async (_name, code) => {
        const fired = rulesFiredFor(code, 'src/lib/probe.js');

        expect(forRule(fired, 'no-restricted-imports').fired).toBe(false);
        expect(forRule(fired, 'no-restricted-syntax').fired).toBe(false);
    });

    test('applies to the entry point as well as to library code', async () => {
        const { fired } = forRule(
            rulesFiredFor(
                "import { extensions } from './lib/extensions/index.js';",
                'src/butler-sos.js'
            ),
            'no-restricted-imports'
        );

        expect(fired).toBe(true);
    });
});
