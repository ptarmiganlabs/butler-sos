import semver from 'semver';

const { satisfies, valid } = semver;

/**
 * Compatibility matrix mapping Butler SOS version ranges to compatible Audit.qs version ranges.
 *
 * Each entry uses semver ranges so patch and minor releases are matched automatically.
 * Only major-version boundaries require a manual matrix update.
 *
 * Butler SOS 15.0.0 is the first release that supports the Audit.qs extension.
 *
 * @type {Array<{ butlerSosVersionRange: string, auditQsVersionRange: string }>}
 */
const COMPATIBILITY_MATRIX = [
    // Butler SOS versions before 15.0.0 do not support Audit.qs, but we include an entry during development of 15.0
    {
        butlerSosVersionRange: '>=14.0.0 <15.0.0',
        auditQsVersionRange: '>=0.3.0 <0.5.0',
    },
    {
        butlerSosVersionRange: '>=15.0.0 <16.0.0',
        auditQsVersionRange: '>=0.3.0 <0.4.0',
    },
];

/**
 * Checks whether a given Butler SOS version is compatible with a given Audit.qs version.
 *
 * @param {string} butlerSosVersion - The Butler SOS version string (e.g. "15.0.0").
 * @param {string} auditQsVersion - The Audit.qs version string (e.g. "0.3.0").
 *
 * @returns {{ compatible: boolean, message: string }}
 *   Result indicating compatibility and a human-readable message.
 */
export function checkCompatibility(butlerSosVersion, auditQsVersion) {
    if (!butlerSosVersion || typeof butlerSosVersion !== 'string') {
        return {
            compatible: false,
            message: 'Unable to determine Butler SOS version for compatibility check.',
        };
    }

    if (!auditQsVersion || typeof auditQsVersion !== 'string') {
        return {
            compatible: false,
            message:
                'Audit.qs version not provided. Butler SOS requires version information to verify compatibility.',
        };
    }

    if (!valid(butlerSosVersion)) {
        return {
            compatible: false,
            message: `Invalid Butler SOS version format: "${butlerSosVersion}".`,
        };
    }

    if (!valid(auditQsVersion)) {
        return {
            compatible: false,
            message: `Invalid Audit.qs version format: "${auditQsVersion}".`,
        };
    }

    // Check if Butler SOS version is covered by any matrix entry
    const matchingEntry = COMPATIBILITY_MATRIX.find((entry) =>
        satisfies(butlerSosVersion, entry.butlerSosVersionRange)
    );

    if (!matchingEntry) {
        return {
            compatible: false,
            message: `Butler SOS ${butlerSosVersion} does not have a known compatibility entry for Audit.qs. Please verify both applications are up to date.`,
        };
    }

    const auditQsCompatible = satisfies(auditQsVersion, matchingEntry.auditQsVersionRange);

    if (auditQsCompatible) {
        return {
            compatible: true,
            message: `Butler SOS ${butlerSosVersion} is compatible with Audit.qs ${auditQsVersion}.`,
        };
    }

    return {
        compatible: false,
        message: `Butler SOS ${butlerSosVersion} is not compatible with Audit.qs ${auditQsVersion}. Compatible Audit.qs versions: ${matchingEntry.auditQsVersionRange}.`,
    };
}
