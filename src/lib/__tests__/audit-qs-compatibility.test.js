import { describe, test, expect } from '@jest/globals';

import { checkCompatibility } from '../audit-qs-compatibility.js';

describe('checkCompatibility: Butler SOS 15.x', () => {
    // 0.5.0 and 0.5.9 are the cases this range was widened for: both were refused
    // while the 15.x entry stopped at <0.5.0.
    test.each(['0.3.0', '0.4.1', '0.5.0', '0.5.9'])('accepts Audit.qs %s', (auditQsVersion) => {
        const result = checkCompatibility('15.1.0', auditQsVersion);

        expect(result.compatible).toBe(true);
        expect(result.message).toBe(
            `Butler SOS 15.1.0 is compatible with Audit.qs ${auditQsVersion}.`
        );
    });

    test.each(['0.2.9', '0.6.0', '1.0.0'])('refuses Audit.qs %s', (auditQsVersion) => {
        const result = checkCompatibility('15.1.0', auditQsVersion);

        expect(result.compatible).toBe(false);
        expect(result.message).toBe(
            `Butler SOS 15.1.0 is not compatible with Audit.qs ${auditQsVersion}. Compatible Audit.qs versions: >=0.3.0 <0.6.0.`
        );
    });

    test('a later 15.x minor release inherits the same range', () => {
        expect(checkCompatibility('15.4.2', '0.5.0').compatible).toBe(true);
        expect(checkCompatibility('15.4.2', '0.6.0').compatible).toBe(false);
    });

    // semver leaves prerelease versions out of a range unless asked to include
    // them, so a prerelease Audit.qs build is refused even inside the range.
    test('refuses a prerelease Audit.qs version inside the range', () => {
        expect(checkCompatibility('15.1.0', '0.5.0-rc.1').compatible).toBe(false);
    });
});

describe('checkCompatibility: outside the 15.x entry', () => {
    // The 14.x entry exists only for development builds made before 15.0.0, which
    // predate Audit.qs 0.5; it is deliberately not widened.
    test('the pre-15.0.0 development entry still stops below Audit.qs 0.5.0', () => {
        expect(checkCompatibility('14.9.0', '0.4.1').compatible).toBe(true);
        expect(checkCompatibility('14.9.0', '0.5.0').compatible).toBe(false);
    });

    test('a Butler SOS version with no matrix entry is refused', () => {
        const result = checkCompatibility('16.0.0', '0.5.0');

        expect(result.compatible).toBe(false);
        expect(result.message).toBe(
            'Butler SOS 16.0.0 does not have a known compatibility entry for Audit.qs. Please verify both applications are up to date.'
        );
    });
});

describe('checkCompatibility: missing or malformed versions', () => {
    test.each([
        [undefined, '0.5.0', 'Unable to determine Butler SOS version for compatibility check.'],
        [
            '15.0.1',
            undefined,
            'Audit.qs version not provided. Butler SOS requires version information to verify compatibility.',
        ],
        ['15.0', '0.5.0', 'Invalid Butler SOS version format: "15.0".'],
        ['15.0.1', '0.5', 'Invalid Audit.qs version format: "0.5".'],
    ])('butlerSos=%s auditQs=%s is refused', (butlerSosVersion, auditQsVersion, message) => {
        const result = checkCompatibility(butlerSosVersion, auditQsVersion);

        expect(result.compatible).toBe(false);
        expect(result.message).toBe(message);
    });
});
