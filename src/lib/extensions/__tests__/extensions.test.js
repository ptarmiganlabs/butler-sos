import { describe, test, expect } from '@jest/globals';

import { extensions } from '#extensions';
import { SEAM_VERSION, assertSeamVersion } from '../version.js';

// Imported through the specifier rather than by path, so this file fails to load if the
// `imports` entry in package.json is removed or renamed - which is the mistake that would
// otherwise surface only inside a packaged binary.

describe('the committed extensions module', () => {
    test('describes nothing', () => {
        expect(extensions).toEqual({
            seamVersion: SEAM_VERSION,
            options: [],
            configSchema: {},
            hooks: {},
        });
    });

    test('names no variant, so --version and the startup log stay as they are', () => {
        expect(extensions.variant).toBeUndefined();
    });

    test('targets the contract version this tree implements', () => {
        expect(() => assertSeamVersion(extensions, 'the stub')).not.toThrow();
    });
});

describe('the contract version check', () => {
    test.each([
        ['an older version', SEAM_VERSION - 1],
        ['a newer version', SEAM_VERSION + 1],
        ['no version at all', undefined],
        ['a version written as a string', String(SEAM_VERSION)],
    ])('refuses a description that targets %s', (_name, seamVersion) => {
        expect(() => assertSeamVersion({ seamVersion }, '/tmp/variant/index.js')).toThrow(
            /Extension contract mismatch: \/tmp\/variant\/index\.js targets seamVersion/
        );
    });

    test('refuses a missing description', () => {
        expect(() => assertSeamVersion(undefined, 'nowhere')).toThrow('contract mismatch');
    });
});
