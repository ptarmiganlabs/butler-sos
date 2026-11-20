import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildDate, commitEpochSeconds, epochSeconds } from '../lib/build-date.mjs';

// The date scripts/bundle.mjs stamps into every binary. With `log.showSignature`
// set, `git log` printed gpg's lines ahead of the timestamp, and the date silently came from the
// clock instead of the commit.

/** 2026-08-23T09:57:21Z, a commit date that is not today. */
const COMMIT_SECONDS = 1787479041;

/**
 * A git that answers with the given output, recording how it was asked.
 *
 * @param {string} stdout - What it prints.
 * @param {Array<object>} calls - Where to record each call.
 *
 * @returns {(command: string, args: string[], options: object) => {status: number, stdout: string}} The runner.
 */
const gitSaying =
    (stdout, calls = []) =>
    (command, args, options) => {
        calls.push({ command, args, options });

        return { status: 0, stdout };
    };

describe('the commit date', () => {
    test('asks git for the committer date of HEAD, and never for its signature', () => {
        const calls = [];

        expect(commitEpochSeconds('/somewhere', gitSaying(`${COMMIT_SECONDS}\n`, calls))).toBe(
            COMMIT_SECONDS
        );
        expect(calls).toHaveLength(1);
        expect(calls[0].command).toBe('git');
        expect(calls[0].args).toEqual(['log', '-1', '--no-show-signature', '--format=%ct']);
        expect(calls[0].options.cwd).toBe('/somewhere');
    });

    // Why the flag is there: this is what `log.showSignature` makes git print for a signed commit,
    // and every merge made through GitHub's web UI is signed.
    test('would not be read from output that carries a signature check', () => {
        const signed = [
            'gpg: Signature made Fri Oct 16 06:13:24 2026 CEST',
            'gpg:                using RSA key B5690EEEBB952194',
            "gpg: Can't check signature: No public key",
            String(COMMIT_SECONDS),
            '',
        ].join('\n');

        expect(commitEpochSeconds('/somewhere', gitSaying(signed))).toBeUndefined();
    });

    test('is undefined outside a usable git checkout', () => {
        const noGit = () => ({ status: 128, stdout: '' });

        expect(commitEpochSeconds('/somewhere', noGit)).toBeUndefined();
    });
});

describe('the commit date, from a real git with log.showSignature set', () => {
    let dir;

    // Every GIT_* variable is removed so that a run from inside a git hook cannot commit into the
    // repository running it, and signing and hooks are switched off so that the developer's own
    // configuration cannot reach in.
    const isolated = Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
    );
    const git = (args, extra = {}) =>
        spawnSync(
            'git',
            [
                ...['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid'],
                ...[
                    '-c',
                    'commit.gpgsign=false',
                    '-c',
                    `core.hooksPath=${path.join(dir, '.no-hooks')}`,
                ],
                ...args,
            ],
            { cwd: dir, encoding: 'utf8', env: { ...isolated, ...extra } }
        );

    beforeAll(() => {
        dir = mkdtempSync(path.join(os.tmpdir(), 'build-date-'));
        writeFileSync(path.join(dir, 'file.txt'), 'content\n');

        const date = `${COMMIT_SECONDS} +0000`;

        for (const args of [
            ['init', '--quiet'],
            ['add', 'file.txt'],
            ['commit', '--quiet', '--no-verify', '-m', 'fixture'],
        ]) {
            const result = git(args, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });

            if (result.status !== 0) {
                throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
            }
        }
    });

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    // A fixture commit cannot be signed portably, so this does not reproduce the gpg output - the
    // test above covers that. It proves the other half: that the git actually installed accepts
    // the flag and still answers with the commit's date when the setting is on.
    test('reads the commit date, not the clock', () => {
        const showSignature = (command, args, options) =>
            spawnSync(command, args, {
                ...options,
                env: {
                    ...isolated,
                    GIT_CONFIG_COUNT: '1',
                    GIT_CONFIG_KEY_0: 'log.showSignature',
                    GIT_CONFIG_VALUE_0: 'true',
                },
            });

        expect(commitEpochSeconds(dir, showSignature)).toBe(COMMIT_SECONDS);
        expect(buildDate({ env: {}, cwd: dir, run: showSignature })).toBe('2026-08-23');
    });
});

describe('the build date', () => {
    const failingGit = () => ({ status: 128, stdout: '' });

    test('takes SOURCE_DATE_EPOCH first', () => {
        expect(
            buildDate({
                env: { SOURCE_DATE_EPOCH: '1798761600' },
                run: gitSaying(`${COMMIT_SECONDS}\n`),
            })
        ).toBe('2027-01-01');
    });

    test('then the commit date', () => {
        expect(buildDate({ env: {}, run: gitSaying(`${COMMIT_SECONDS}\n`) })).toBe('2026-08-23');
    });

    test('and the clock only when neither is there', () => {
        expect(buildDate({ env: {}, now: Date.UTC(2030, 0, 2), run: failingGit })).toBe(
            '2030-01-02'
        );
    });

    test.each(['', '   ', 'yesterday', '1.5'])(
        'skips a SOURCE_DATE_EPOCH that is not an integer (%p)',
        (value) => {
            expect(epochSeconds(value)).toBeUndefined();
            expect(
                buildDate({
                    env: { SOURCE_DATE_EPOCH: value },
                    run: gitSaying(`${COMMIT_SECONDS}\n`),
                })
            ).toBe('2026-08-23');
        }
    );
});
