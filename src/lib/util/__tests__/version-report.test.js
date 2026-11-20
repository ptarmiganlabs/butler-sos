import { describe, test, expect } from '@jest/globals';

import {
    BUILD_DATE,
    EXTENSIONS_VERSION,
    describeVersion,
    versionStampLine,
} from '../version-report.js';

describe('describeVersion', () => {
    test('a stock build reports its version alone, as it always has', () => {
        expect(describeVersion({ name: 'butler-sos', version: '15.1.3' })).toBe('15.1.3');
        expect(
            describeVersion({ name: 'butler-sos', version: '15.1.3', buildDate: '2026-11-20' })
        ).toBe('15.1.3');
    });

    test('a variant build names itself, then lists both versions and the build date', () => {
        expect(
            describeVersion({
                name: 'butler-sos',
                version: '15.2.0',
                variant: 'acme',
                variantVersion: '2.1.0',
                buildDate: '2027-01-14',
            })
        ).toBe(
            [
                'butler-sos 15.2.0 (acme)',
                '  core    15.2.0',
                '  acme    2.1.0',
                '  built   2027-01-14',
            ].join('\n')
        );
    });

    test('leaves out what it does not know', () => {
        expect(describeVersion({ name: 'butler-sos', version: '15.2.0', variant: 'acme' })).toBe(
            'butler-sos 15.2.0 (acme)\n  core    15.2.0'
        );
    });

    test('keeps a gap after a variant name longer than the label column', () => {
        const report = describeVersion({
            name: 'butler-sos',
            version: '15.2.0',
            variant: 'enterprise',
            variantVersion: '2.1.0',
        });

        expect(report.split('\n')[2]).toBe('  enterprise 2.1.0');
    });
});

describe('versionStampLine', () => {
    test('a stock report is already one line', () => {
        expect(versionStampLine('15.1.3')).toBe('15.1.3');
    });

    test('folds a variant report onto one line', () => {
        expect(
            versionStampLine(
                'butler-sos 15.2.0 (acme)\n  core    15.2.0\n  acme    2.1.0\n  built   2027-01-14'
            )
        ).toBe('butler-sos 15.2.0 (acme) - core 15.2.0, acme 2.1.0, built 2027-01-14');
    });
});

describe('outside a bundle', () => {
    test('nothing is injected, so neither constant is set', () => {
        expect(BUILD_DATE).toBeUndefined();
        expect(EXTENSIONS_VERSION).toBeUndefined();
    });
});
