import globals from '../globals.js';
import { confifgFileSchema } from './config-file-schema.js';

// Function to verify that the config file has the correct format
// Use yaml-validator to validate the config file
export async function verifyConfigFile() {
    //
    try {
        // Dynamically load yaml-validator
        const YamlValidator = (await import('yaml-validator')).default;

        // Options for yaml-validator
        const verifyOptions = {
            onWarning(error, filepath) {
                globals.logger.warn(`${filepath} has error: ${error}`);
            },
            log: false,
            structure: confifgFileSchema,
            writeJson: false,
        };

        // Create a new instance of yaml-validator
        const validator = new YamlValidator(verifyOptions);

        // File names to validate in array
        const files = [globals.configFile];

        // Verify the config file
        validator.validate(files);

        // Exit app if there are errors in the config file's structure
        if (validator.logs.length > 0) {
            globals.logger.verbose(`VERIFY CONFIG FILE: Logs length: ${validator.logs.length}`);
            globals.logger.verbose(validator.logs);

            globals.logger.error(`VERIFY CONFIG FILE: Errors found in config file. Exiting.`);
            globals.logger.error(
                `Tip: Start Butler SOS with --no-config-file-verify option to skip this check and start with provided config file. `
            );
            globals.logger.error(`${validator.logs}`);

            process.exit(1);
        }

        // ------------------------------
        // Verify values of specific config entries

        // If InfluxDB is enabled, check if the version is valid
        // Valid values: 1 and 2
        if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            const influxdbVersion = globals.config.get('Butler-SOS.influxdbConfig.version');
            if (influxdbVersion !== 1 && influxdbVersion !== 2) {
                globals.logger.error(
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
            const serverTagsDefinition = globals.config.get(
                'Butler-SOS.serversToMonitor.serverTagsDefinition'
            );
            for (const tag of serverTagsDefinition) {
                // Check that all servers have this tag
                const servers = globals.config.get('Butler-SOS.serversToMonitor.servers');
                for (const server of servers) {
                    // Check if server.serverTags.tag is defined
                    if (server?.serverTags === null || !server?.serverTags[tag]) {
                        globals.logger.error(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is not defined for server "${server.serverName}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        globals.logger.verbose(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is defined for server "${server.serverName}".`
                        );
                    }
                }
            }

            // Now ensure that the tags defined for each server are valid and that there are no extra tags there
            const servers = globals.config.get('Butler-SOS.serversToMonitor.servers');
            for (const server of servers) {
                for (const tag in server.serverTags) {
                    if (!serverTagsDefinition.includes(tag)) {
                        globals.logger.error(
                            `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server.serverName}" is not defined in Butler-SOS.serversToMonitor.serverTagsDefinition. Exiting.`
                        );
                        process.exit(1);
                    } else {
                        globals.logger.verbose(
                            `VERIFY CONFIG FILE: Server tag "${tag}" is defined in Butler-SOS.serversToMonitor.serverTagsDefinition.`
                        );
                    }
                }
            }
        } catch (err) {
            globals.logger.error(`VERIFY CONFIG FILE: Server tags verification failed. ${err}`);
            process.exit(1);
        }

        globals.logger.info(
            `VERIFY CONFIG FILE: Your config file at ${globals.configFile} is valid, good work!`
        );

        return true;
    } catch (err) {
        globals.logger.error(`VERIFY CONFIG FILE: ${err}`);

        return false;
    }
}
