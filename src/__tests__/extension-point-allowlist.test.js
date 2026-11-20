import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The other half of the extension-point boundary. The ESLint rule covers imports; this
// covers files, because a file nobody imports yet is still contract surface in a directory the
// build can substitute wholesale.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/check-extension-point.mjs';

/**
 * Run the allowlist check over a set of paths.
 *
 * @param {string[]} paths - Repo-relative paths to check. Empty means "whatever is in the directory".
 *
 * @returns {{status: number, output: string}} Exit status and everything it printed.
 */
const check = (paths) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...paths], {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

/**
 * Run the check against a throwaway tree containing exactly the files named.
 *
 * The whole-directory mode reads the real `src/lib/extensions/`, so proving what it does about a
 * file that has gone missing would otherwise mean deleting one from the working tree mid-test and
 * hoping the restore runs. A fixture costs nothing and cannot leave the repo broken.
 *
 * @param {string[]} files - Repo-relative paths to create under the temporary root.
 *
 * @returns {{status: number, output: string}} Exit status and everything it printed.
 */
const checkFixture = (files) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'extension-point-'));

    try {
        for (const file of files) {
            const target = path.join(root, file);

            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, 'export const placeholder = 1;\n');
        }

        mkdirSync(path.join(root, 'scripts'), { recursive: true });

        const result = spawnSync(process.execPath, [path.join(repoRoot, SCRIPT)], {
            cwd: root,
            encoding: 'utf8',
        });

        return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
};

/** Everything the allowlist says belongs under the extension point. */
const ALL_LISTED = [
    'src/lib/extensions/index.js',
    'src/lib/extensions/apply.js',
    'src/lib/extensions/version.js',
    'src/lib/extensions/__tests__/apply.test.js',
    'src/lib/extensions/__tests__/extensions.test.js',
];

describe('the extension point allowlist', () => {
    // The one that does real work on every CI run rather than only in a pre-commit hook: it reads
    // the directory as it actually is. A file added without a matching allowlist entry fails here
    // even if the hook was bypassed with --no-verify, which is the only backstop available once a
    // push has already happened.
    test('the committed directory matches the allowlist exactly', () => {
        const { status, output } = check([]);

        expect(output).toBe('');
        expect(status).toBe(0);
    });

    test.each([
        ['the committed default', 'src/lib/extensions/index.js'],
        ['the core-side helper', 'src/lib/extensions/apply.js'],
        ['the version module', 'src/lib/extensions/version.js'],
        ['a listed test', 'src/lib/extensions/__tests__/apply.test.js'],
    ])('accepts %s', (_name, filePath) => {
        expect(check([filePath]).status).toBe(0);
    });

    test.each([
        ['a file in a new subdirectory', 'src/lib/extensions/subdir/unlisted.js'],
        ['a flat file beside the default', 'src/lib/extensions/unlisted.js'],
        ['an unlisted test', 'src/lib/extensions/__tests__/something-else.test.js'],
    ])('rejects %s', (_name, filePath) => {
        const { status, output } = check([filePath]);

        expect(status).toBe(1);
        expect(output).toContain(filePath);
    });

    test('says what to do about it, so the guard is not simply worked around', () => {
        const { output } = check(['src/lib/extensions/subdir/unlisted.js']);

        expect(output).toContain('allowlist');
        expect(output).toContain(SCRIPT);
    });

    // The shape the trailing-slash blind spot lets through: the whole directory replaced by a
    // symlink stages as this one path, with nothing after it.
    test('rejects the directory itself, not only paths inside it', () => {
        const { status, output } = check(['src/lib/extensions']);

        expect(status).toBe(1);
        expect(output).toContain('src/lib/extensions');
    });

    test('reports a listed file that is no longer there', () => {
        const { status, output } = checkFixture(
            ALL_LISTED.filter((f) => !f.endsWith('version.js'))
        );

        expect(status).toBe(1);
        expect(output).toContain('missing');
        expect(output).toContain('src/lib/extensions/version.js');
    });

    test('is silent when the fixture matches the allowlist exactly', () => {
        const { status, output } = checkFixture(ALL_LISTED);

        expect(output).toBe('');
        expect(status).toBe(0);
    });

    test('reports an extra file and a missing one together', () => {
        const { status, output } = checkFixture([
            ...ALL_LISTED.filter((f) => !f.endsWith('version.js')),
            'src/lib/extensions/unlisted.js',
        ]);

        expect(status).toBe(1);
        expect(output).toContain('src/lib/extensions/version.js');
        expect(output).toContain('src/lib/extensions/unlisted.js');
    });

    test('ignores paths outside the directory', () => {
        expect(check(['src/globals.js', 'scripts/bundle.mjs']).status).toBe(0);
    });

    // Git reports staged paths with forward slashes on every platform, but a Windows contributor
    // running the script by hand would not.
    test('accepts a Windows-style path for a listed file', () => {
        expect(check(['src\\lib\\extensions\\apply.js']).status).toBe(0);
    });

    test('rejects a Windows-style path for an unlisted one', () => {
        expect(check(['src\\lib\\extensions\\subdir\\unlisted.js']).status).toBe(1);
    });
});
