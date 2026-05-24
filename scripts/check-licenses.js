#!/usr/bin/env node

/**
 * License compliance checker.
 *
 * Fails (exit code 1) if any dependency uses a license not in the allowlist.
 * Run via: npm run license:check
 */

import { init as licenseCheckerInit } from 'license-checker-rseidelsohn';

/**
 * Licenses approved for use in this project.
 * Add new entries here (not in package.json) when legal/compliance approves them.
 */
const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'Apache2',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'BlueOak-1.0.0',
  'Python-2.0',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  '(Apache-2.0 AND BSD-3-Clause)',
  '(MIT OR Apache-2.0)',
  'MIT,Apache2',
  '(MIT AND CC-BY-3.0)',
  '(MIT OR CC0-1.0)',
];

/**
 * Normalises a license string for comparison.
 *
 * license-checker-rseidelsohn may return licenses with extra whitespace or
 * different casing.  We trim and lowercase both sides before comparing.
 *
 * @param {string} license - Raw license string from the checker.
 * @returns {string} Normalised license string.
 */
function normalise(license) {
  return license.trim().toLowerCase();
}

const allowedSet = new Set(ALLOWED_LICENSES.map(normalise));

licenseCheckerInit({ start: process.cwd() }, (err, packages) => {
  if (err) {
    console.error('license-checker failed:', err.message);
    process.exit(2);
  }

  const disallowed = [];

  for (const [pkgId, pkgInfo] of Object.entries(packages)) {
    const licenses = Array.isArray(pkgInfo.licenses)
      ? pkgInfo.licenses
      : [pkgInfo.licenses];

    for (const lic of licenses) {
      if (!allowedSet.has(normalise(lic))) {
        disallowed.push({ package: pkgId, license: lic });
      }
    }
  }

  if (disallowed.length > 0) {
    console.error('\n License compliance check FAILED\n');
    console.error('The following packages use licenses not in the allowlist:\n');

    for (const item of disallowed) {
      console.error(`  ${item.package}: ${item.license}`);
    }

    console.error(
      `\n  Allowed licenses: ${ALLOWED_LICENSES.join(', ')}\n`,
    );
    console.error(
      '  To add a license, update the ALLOWED_LICENSES array in scripts/check-licenses.js\n',
    );
    process.exit(1);
  }

  console.log(
    `License check passed — ${Object.keys(packages).length} packages, all licenses approved.`,
  );
  process.exit(0);
});
