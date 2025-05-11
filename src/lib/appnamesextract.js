// Get app names from the Qlik Repository Service (QRS) API
import qrsInteract from 'qrs-interact';
import clonedeep from 'lodash.clonedeep';

import globals from '../globals.js';

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
                // Return error msg
                globals.logger.error(`APP NAMES: Error getting app names: ${err}`);
            });
    } catch (err) {
        globals.globals.logger.error(`APP NAMES: ${err}`);
    }
}

export function setupAppNamesExtractTimer() {
    // Configure timer for getting app names data
    setInterval(() => {
        globals.logger.verbose('APP NAMES: Event started: Get app names');

        getAppNames();
    }, globals.config.get('Butler-SOS.appNames.extractInterval'));
}
