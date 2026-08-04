import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards the single-source property of the pinned GitNexus version.
 *
 * The version used to be repeated in the git hook and in every gitnexus:* npm script,
 * kept together by nothing but a "keep this in sync" comment — and it drifted, to the
 * point where CLAUDE.md and AGENTS.md described two copies while five existed. It now
 * lives only in scripts/gitnexus.js. These tests fail if a second copy comes back.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Reads a repository file as text.
 *
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} File contents.
 */
function readRepoFile(relativePath) {
    return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('GitNexus version pinning', () => {
    test('the wrapper declares exactly one pinned version', () => {
        const matches = readRepoFile('scripts/gitnexus.js').match(
            /const GITNEXUS_VERSION = '\d+\.\d+\.\d+';/g
        );

        expect(matches).toHaveLength(1);
    });

    test.each(['package.json', '.husky/gitnexus-reindex.sh'])(
        '%s pins no gitnexus version of its own',
        (file) => {
            expect(readRepoFile(file)).not.toMatch(/gitnexus@\d/);
        }
    );

    test('every gitnexus npm script routes through the wrapper', () => {
        const { scripts } = JSON.parse(readRepoFile('package.json'));
        const gitnexusScripts = Object.entries(scripts).filter(([scriptName]) =>
            scriptName.startsWith('gitnexus:')
        );

        expect(gitnexusScripts.length).toBeGreaterThan(0);

        for (const [, commandLine] of gitnexusScripts) {
            expect(commandLine).toMatch(/^node scripts\/gitnexus\.js [a-z]+$/);
        }
    });

    test('the git hook routes through the wrapper', () => {
        const hook = readRepoFile('.husky/gitnexus-reindex.sh');

        expect(hook).toMatch(/node scripts\/gitnexus\.js check/);
        expect(hook).toMatch(/node scripts\/gitnexus\.js index/);
    });
});

describe('GitNexus reindex hook', () => {
    const hook = readRepoFile('.husky/gitnexus-reindex.sh');

    test('a missing wrapper is reported separately from a missing install', () => {
        // Checking out any commit made before the wrapper existed leaves the hook with
        // no scripts/gitnexus.js. Reporting that as "not installed" would send the
        // reader to `npm run gitnexus:install`, which does not fix it.
        expect(hook).toMatch(/if \[ ! -f scripts\/gitnexus\.js \]; then/);
        expect(hook).toMatch(/scripts\/gitnexus\.js not in this checkout/);
    });

    test('node and npx are both probed before use', () => {
        expect(hook).toMatch(/command -v node/);
        expect(hook).toMatch(/command -v npx/);
    });

    test('every exit in the hook is exit 0, so git is never blocked', () => {
        const exits = hook.match(/^\s*exit \d+$/gm) ?? [];

        expect(exits.length).toBeGreaterThan(0);
        for (const exitLine of exits) {
            expect(exitLine.trim()).toBe('exit 0');
        }
    });
});
