// Get app names from the Qlik Repository Service (QRS) API
import qrsInteract from 'qrs-interact';
import clonedeep from 'lodash.clonedeep';

import globals from '../globals.js';
import { logError } from './log-error.js';

/**
 * Retrieves application names from the Qlik Repository Service (QRS) API.
 *
 * This function connects to the Qlik Sense repository database and fetches
 * information about all available applications. It stores the app information
 * (id, name, description) in the global appNames variable for use throughout
 * the Butler SOS application.
 *
 * @returns {void}
 */
export function getAppNames() {
    globals.logger.verbose(`APP NAMES: Start getting app names from repository db`);

    // Set up Sense repository service configuration
    const configQRS = {
        hostname: globals.config.get('Butler-SOS.appNames.hostIP'),
        portNumber: 4242,
        certificates: {
            certFile: globals.certPath,
            keyFile: globals.keyPath,
        },
    };

    configQRS.headers = {
        'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
    };

    const qrsInteractInstance = new qrsInteract(configQRS);

    const appList = [];

    try {
        qrsInteractInstance
            .Get('app')
            .then((result) => {
                result.body.forEach((element) => {
                    appList.push({
                        id: element.id,
                        name: element.name,
                        description: element.description,
                    });
                }, this);

                globals.logger.verbose(`APP NAMES: Number of apps: ${appList.length}`);
                globals.logger.debug(`APP NAMES: App list JSON: ${JSON.stringify(appList)}`);

                // Only set the global app names variable once all app names have been successfully retrieved
                globals.appNames = clonedeep(appList);

                globals.logger.verbose('APP NAMES: Done getting app names from repository db');
            })
            .catch((err) => {
                // Track error count
                const hostname = globals.config.get('Butler-SOS.appNames.hostIP');
                globals.errorTracker.incrementError('APP_NAMES_EXTRACT', hostname || '');

                // Return error msg
                logError('APP NAMES: Error getting app names', err);
            });
    } catch (err) {
        // Track error count
        const hostname = globals.config.get('Butler-SOS.appNames.hostIP');
        globals.errorTracker.incrementError('APP_NAMES_EXTRACT', hostname || '');

        logError('APP NAMES', err);
    }
}

/**
 * Sets up a timer for periodically retrieving app names from the Qlik Repository Service.
 *
 * This function initializes a timer that calls getAppNames() at regular intervals
 * specified by the Butler-SOS.appNames.extractInterval configuration setting.
 * This ensures that the Butler SOS application always has up-to-date information
 * about Qlik Sense applications.
 *
 * @returns {void}
 */
export function setupAppNamesExtractTimer() {
    // Configure timer for getting app names data
    setInterval(() => {
        globals.logger.verbose('APP NAMES: Event started: Get app names');

        getAppNames();
    }, globals.config.get('Butler-SOS.appNames.extractInterval'));
}
