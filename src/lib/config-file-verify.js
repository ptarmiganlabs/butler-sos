import { load } from 'js-yaml';
import fs from 'fs/promises';
import { default as Ajv } from 'ajv';

import { confifgFileSchema } from './config-file-schema.js';

/**
 * Verifies that the config file has the correct format.
 * Use yaml-validator to validate the config file
 *
 * @param {string} configFile path to the config file to verify
 * @returns {Promise<boolean>} true if the config file is valid, false otherwise
 */
export async function verifyConfigFileSchema(configFile) {
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

        // Load the YAML schema file, identified by configFile, from file
        const fileContent = await fs.readFile(configFile, 'utf8');

        // Parse the YAML file
        let parsedFileContent;
        try {
            parsedFileContent = load(fileContent);
        } catch (err) {
            console.error(`VERIFY CONFIG FILE: Error parsing YAML file: ${err}`);
            return false;
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
                console.error(`VERIFY CONFIG FILE ERROR: ${error.instancePath} : ${error.message}`);
            }

            process.exit(1);
        }

        console.info(
            `VERIFY CONFIG FILE: Your config file at ${configFile} is correctly formatted, good work!`
        );

        return true;
    } catch (err) {
        console.error(`VERIFY CONFIG FILE: ${err}`);

        return false;
    }
}

// Function to do verification of app specific settings and relationships between settings
/**
 * Verifies application-specific settings and relationships between configuration settings.
 *
 * This function performs validation beyond simple schema validation, checking:
 * 1. If InfluxDB is enabled, verifies that version is valid (must be 1 or 2)
 * 2. Validates server tag configuration:
 *    - All tags defined in serverTagsDefinition must be set for each server
 *    - All tags specified for each server must be present in serverTagsDefinition
 *
 * @param {object} cfg - The configuration object to verify
 * @returns {Promise<boolean>} A promise that resolves to true if all checks pass, false otherwise
 */
export async function verifyAppConfig(cfg) {
    // Verify values of specific config entries

    // If InfluxDB is enabled, check if the version is valid
    // Valid values: 1 and 2
    if (cfg.get('Butler-SOS.influxdbConfig.enable') === true) {
        const influxdbVersion = cfg.get('Butler-SOS.influxdbConfig.version');
        if (influxdbVersion !== 1 && influxdbVersion !== 2) {
            console.error(
                `VERIFY CONFIG FILE ERROR: Butler-SOS.influxdbConfig.enable (=InfluxDB version) ${influxdbVersion} is invalid. Exiting.`
            );
            return false;
        }
    }

    // Verify that telemetry and system info settings are compatible
    // If telemetry is enabled but system info gathering is disabled, this creates an incompatibility
    // because telemetry relies on detailed system information for proper functionality
    const anonTelemetryEnabled = cfg.get('Butler-SOS.anonTelemetry');
    const systemInfoEnabled = cfg.get('Butler-SOS.systemInfo.enable');

    if (anonTelemetryEnabled === true && systemInfoEnabled === false) {
        console.error(
            'VERIFY CONFIG FILE ERROR: Anonymous telemetry is enabled (Butler-SOS.anonTelemetry=true) but system information gathering is disabled (Butler-SOS.systemInfo.enable=false). Telemetry requires detailed system information to function properly. Either disable telemetry by setting Butler-SOS.anonTelemetry=false or enable system info gathering by setting Butler-SOS.systemInfo.enable=true. Exiting.'
        );
        return false;
    }

    // Verify that server tags are correctly defined
    // In the config file section `Butler-SOS.serversToMonitor.serverTagsDefinition` it's possible to define zero or more tags that can be set for each server that is to be monitored.
    // When Butler SOS is started, do the following checks:
    // 1. All tags present in `Butler-SOS.serversToMonitor.serverTagsDefinition` must be set for each server in `SOS.serversToMonitor.servers[]`
    // 2. The tags specified for each server in `SOS.serversToMonitor.servers[].serverTags` must be present in `Butler-SOS.serversToMonitor.serverTagsDefinition`
    // If either of the conditions above is false, an error should be logged and Butler SOS should not start.
    try {
        // Loop over all defined server tags
        const serverTagsDefinition = cfg.get('Butler-SOS.serversToMonitor.serverTagsDefinition');
        for (const tag of serverTagsDefinition) {
            // Check that all servers have this tag
            const servers = cfg.get('Butler-SOS.serversToMonitor.servers');
            for (const server of servers) {
                // Check if server.serverTags.tag is defined
                if (server?.serverTags === null || !server?.serverTags[tag]) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" is not defined for server "${server.serverName}". Exiting.`
                    );
                    return false;
                } else {
                    // The tag is defined for this server
                }
            }
        }

        // Now ensure that the tags defined for each server are valid and that there are no extra tags there
        const servers = cfg.get('Butler-SOS.serversToMonitor.servers');
        for (const server of servers) {
            for (const tag in server.serverTags) {
                if (!serverTagsDefinition.includes(tag)) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server.serverName}" is not defined in Butler-SOS.serversToMonitor.serverTagsDefinition. Exiting.`
                    );
                    return false;
                } else {
                    // The tag is defined in Butler-SOS.serversToMonitor.serverTagsDefinition
                }
            }
        }

        return true;
    } catch (err) {
        console.error(`VERIFY CONFIG FILE: Server tags verification failed. ${err}`);
        return false;
    }
}
