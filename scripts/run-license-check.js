import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedLicenses = [
    'MIT',
    'Apache-2.0',
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const licenseCheckerPath = path.resolve(
    __dirname,
    '../node_modules/license-checker-rseidelsohn/bin/license-checker-rseidelsohn.js'
);

const result = spawnSync(
    process.execPath,
    [licenseCheckerPath, '--onlyAllow', allowedLicenses.join(';')],
    {
        stdio: 'inherit',
    }
);

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
