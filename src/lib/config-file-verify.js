import { load } from 'js-yaml';
import fs from 'fs/promises';
import { default as Ajv } from 'ajv';

import globals from '../globals.js';
import { confifgFileSchema } from './config-file-schema.js';

// Function to verify that the config file has the correct format
// Use yaml-validator to validate the config file
export async function verifyConfigFile() {
    try {
        const ajv = new Ajv({
            strict: true,
            async: true,
            allErrors: true,
        });

        // Dynamically import ajv-keywords
        const ajvKeywords = await import('ajv-keywords');

        // Add keywords to ajv instance
        ajvKeywords.default(ajv);

        // Dynamically import ajv-formats
        const ajvFormats = await import('ajv-formats');

        // Add formats to ajv instance
        ajvFormats.default(ajv);

        // Load the YAML schema file, identified by globals.configFile, from file
        const fileContent = await fs.readFile(globals.configFile, 'utf8');

        // Parse the YAML file
        let parsedFileContent;
        try {
            parsedFileContent = load(fileContent);
        } catch (err) {
            throw new Error(`VERIFY CONFIG FILE: Error parsing YAML file: ${err}`);
        }

        // Validate the parsed YAML file against the schema
        const validate = ajv.compile(confifgFileSchema);
        const valid = await validate(parsedFileContent);

        if (!valid) {
            // Log the errors in validate.errors[] and exit
            // Each object in the error array has the following properties:
            // - instancePath: Textual path to the part of the data that triggered the error
            // - schemaPath: A JSON Pointer to the part of the schema that triggered the error
            // - keyword: The validation keyword that failed
            // - params: The parameters for the keyword
            // - message: The error message

            for (const error of validate.errors) {
                globals.logger.error(
                    `VERIFY CONFIG FILE: ${error.instancePath} : ${error.message}`
                );
            }

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
