const { config, configFile, logger } = require('../globals');
const { confifgFileSchema } = require('./config-file-schema');

// Function to verify that the config file has the correct format
// Use yaml-validator to validate the config file
async function verifyConfigFile() {
    //
    try {
        // Dynamically load yaml-validator
        const YamlValidator = (await import('yaml-validator')).default;

        // Options for yaml-validator
        const verifyOptions = {
            onWarning(error, filepath) {
                logger.warn(`${filepath} has error: ${error}`);
            },
            log: false,
            structure: confifgFileSchema,
            writeJson: false,
        };

        // Create a new instance of yaml-validator
        const validator = new YamlValidator(verifyOptions);

        // File names to validate in array
        const files = [configFile];

        // Verify the config file
        validator.validate(files);

        // Exit app if there are errors in the config file's structure
        if (validator.logs.length > 0) {
            logger.verbose(`VERIFY CONFIG FILE: Logs length: ${validator.logs.length}`);
            logger.verbose(validator.logs);

            logger.error(`VERIFY CONFIG FILE: Errors found in config file. Exiting.`);
            logger.error(
                `Tip: Start Butler SOS with --no-config-file-verify option to skip this check and start with provided config file. `
            );
            logger.error(`${validator.logs}`);

            process.exit(1);
        }

        // Verify values of specific config entries

        // If InfluxDB is enabled, check if the version is valid
        // Valid values: 1 and 2
        if (config.get('Butler-SOS.influxdbConfig.enable') === true) {
            const influxdbVersion = config.get('Butler-SOS.influxdbConfig.version');
            if (influxdbVersion !== 1 && influxdbVersion !== 2) {
                logger.error(
                    `VERIFY CONFIG FILE: Butler-SOS.influxdbConfig.enable (=InfluxDB version) ${influxdbVersion} is invalid. Exiting.`
                );
                process.exit(1);
            }
        }

        // Verify that server tags are correctly defined
        // In the config file section `Butler-SOS.serversToMonitor.serverTagsDefinition` it's possible to define zero or more tags that can be set for each server that is to be monitored.
        // When Butler SOS is started, do the following checks:
        // 1. All tags present in `Butler-SOS.serversToMonitor.serverTagsDefinition` must be set for each server in `SOS.serversToMonitor.servers[]`
        // 2. The tags specified for each server in `SOS.serversToMonitor.servers[].serverTags` must be present in `Butler-SOS.serversToMonitor.serverTagsDefinition`
        // If either of the conditions above is false, an error should be logged and Butler SOS should not start.
        try {
            // Loop over all defined server tags
            const serverTagsDefinition = config.get(
                'Butler-SOS.serversToMonitor.serverTagsDefinition'
            );
            // eslint-disable-next-line no-restricted-syntax
            for (const tag of serverTagsDefinition) {
                // Check that all servers have this tag
                const servers = config.get('Butler-SOS.serversToMonitor.servers');
                // eslint-disable-next-line no-restricted-syntax
                for (const server of servers) {
                    // Check if server.serverTags.tag is defined
                    if (server?.serverTags === null || !server?.serverTags[tag]) {
                        logger.error(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is not defined for server "${server.serverName}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        logger.verbose(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is defined for server "${server.serverName}".`
                        );
                    }
                }
            }

            // Now ensure that the tags defined for each server are valid and that there are no extra tags there
            const servers = config.get('Butler-SOS.serversToMonitor.servers');
            // eslint-disable-next-line no-restricted-syntax
            for (const server of servers) {
                // eslint-disable-next-line no-restricted-syntax
                for (const tag in server.serverTags) {
                    if (!serverTagsDefinition.includes(tag)) {
                        logger.error(
                            `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server.serverName}" is not defined in Butler-SOS.serversToMonitor.serverTagsDefinition. Exiting.`
                        );
                        process.exit(1);
                    } else {
                        logger.verbose(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is defined in Butler-SOS.serversToMonitor.serverTagsDefinition.`
                        );
                    }
                }
            }
        } catch (err) {
            logger.error(`VERIFY CONFIG FILE: Server tags verification failed. ${err}`);
            process.exit(1);
        }

        logger.info(`VERIFY CONFIG FILE: Your config file at ${configFile} is valid, good work!`);

        return 'boolean';
    } catch (err) {
        logger.error(`VERIFY CONFIG FILE: ${err}`);
        return [];
    }
}

module.exports = {
    verifyConfigFile,
};
