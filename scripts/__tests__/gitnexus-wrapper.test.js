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
        '%s neither pins nor invokes gitnexus itself',
        (file) => {
            // Comments are stripped so prose about npx cannot trip the second assertion.
            const contents = readRepoFile(file).replace(/^\s*#.*$/gm, '');

            // Any spec, not only a numeric one. `gitnexus@latest` and `gitnexus@^1.6.5`
            // are worse than a duplicated pin, not better: the pin exists so that a hook
            // firing after every commit cannot run whatever the registry serves that day.
            expect(contents).not.toMatch(/gitnexus@/);

            // An unversioned invocation is the same hazard by another route — npx would
            // resolve it to latest.
            expect(contents).not.toMatch(/npx[^\n]*gitnexus/i);
        }
    );

    test('the wrapper sets exitCode rather than calling process.exit()', () => {
        // process.exit() terminates before pending asynchronous stdio writes complete.
        // stderr is asynchronous when it is a pipe, so the usage and error messages
        // could be lost under `... 2>&1 | tee log` while looking fine interactively.
        //
        // Comments are stripped first: the wrapper explains this hazard in prose, and
        // matching that prose would fail the test for describing the very thing it
        // forbids.
        const code = readRepoFile('scripts/gitnexus.js')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');

        expect(code).not.toMatch(/process\.exit\(/);
        expect(code).toMatch(/process\.exitCode = /);
    });

    test('every gitnexus npm script routes through the wrapper', () => {
        const { scripts } = JSON.parse(readRepoFile('package.json'));
        const gitnexusScripts = Object.entries(scripts).filter(([scriptName]) =>
            scriptName.startsWith('gitnexus:')
        );

        expect(gitnexusScripts.length).toBeGreaterThan(0);

        for (const [, commandLine] of gitnexusScripts) {
            // Anchored on the prefix only. What matters is that the script goes through
            // the wrapper; a future subcommand may be hyphenated or take arguments, and
            // that should not fail a test about routing.
            expect(commandLine).toMatch(/^node scripts\/gitnexus\.js\b/);
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

    test('every exit in the hook is an explicit exit 0, so git is never blocked', () => {
        // Deliberately not anchored to the start of a line: two of the hook's exits are
        // guarded (`command -v node ... || exit 0`), and an anchored pattern silently
        // skipped them — rewriting one to `exit 1` used to pass this test.
        //
        // Comments are stripped so prose about exit codes neither satisfies nor breaks it.
        const code = hook.replace(/^\s*#.*$/gm, '');
        const exitStatements = code.match(/exit\s+\d+/g) ?? [];
        const exitKeywords = code.match(/\bexit\b/g) ?? [];

        expect(exitKeywords.length).toBeGreaterThan(0);

        // Every `exit` must carry an explicit status. A bare `exit` in sh returns the
        // previous command's status, which is exactly how a hook ends up blocking a commit.
        expect(exitStatements).toHaveLength(exitKeywords.length);

        for (const statement of exitStatements) {
            expect(statement.replace(/\s+/g, ' ')).toBe('exit 0');
        }
    });
});
