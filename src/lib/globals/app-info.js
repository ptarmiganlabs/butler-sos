import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import upath from 'path';
import sea from '../sea-wrapper.js';

/**
 * Initializes the application version and base paths.
 *
 * @param {object} settings - The settings object to populate
 */
export async function initAppInfo(settings) {
    // Get app version from package.json file
    const filenamePackage = `./package.json`;
    let a;
    let b;
    let c;
    let appVersion;

    // Are we running as a packaged app?
    if (sea.isSea()) {
        // Get contents of package.json file
        const packageJson = sea.getAsset('package.json', 'utf8');
        const version = JSON.parse(packageJson).version;

        appVersion = version;
    } else {
        // Get path to JS file
        a = fileURLToPath(import.meta.url);

        // Strip off the filename
        b = upath.dirname(a);

        // Add path to package.json file
        // Note: Since this file is now in src/lib/globals, we need to go up 3 levels to reach root
        c = upath.join(b, '..', '..', '..', filenamePackage);

        const { version } = JSON.parse(readFileSync(c));
        appVersion = version;

        // Set base path of the executable
        settings.appBasePath = upath.join(b, '..', '..', '..');
    }

    settings.appVersion = appVersion;
}
