import upath from 'path';
import mqtt from 'mqtt';
import { fileURLToPath } from 'url';
import sea from './lib/sea-wrapper.js';

import {
    getErrorMessage,
    checkFileExistsSync,
    sleep,
    isRunningInDocker,
} from './lib/globals/utils.js';
import { initAppInfo } from './lib/globals/app-info.js';
import { initCommandLine } from './lib/globals/command-line.js';
import { initConfig } from './lib/globals/config-loader.js';
import { initLogging } from './lib/globals/logging.js';
import { initUdp } from './lib/globals/udp-servers.js';
import { initInfluxDBClient, initInfluxDB } from './lib/globals/influxdb.js';
import { initHostInfo } from './lib/globals/host-info.js';

let instance = null;

/**
 * Utility class for managing global application settings and configurations.
 *
 * Implements the singleton pattern to ensure only one instance exists.
 * Provides methods for initializing settings, logging, and managing application state.
 *
 * @class Settings
 * @property {boolean} initialised - Flag indicating if the settings have been initialized.
 * @property {boolean} isSea - Flag indicating if the app is running as a Single Executable Application.
 * @property {Array} appNames - Array for storing application IDs and names.
 * @property {string} certPath - Path to the client certificate.
 * @property {string} keyPath - Path to the client certificate key.
 * @property {string} caPath - Path to the client certificate CA.
 * @property {object} mqttClient - MQTT client instance.
 * @property {object} hostInfo - Information about the host system.
 * @property {object} config - Configuration object.
 * @property {object} logger - Logger instance.
 * @property {object} options - Command line options.
 */
export class Settings {
    /**
     * Creates a new Settings instance or returns the existing singleton instance.
     * Implements the singleton pattern for global application settings.
     *
     * @returns {Settings} The singleton instance of the Settings class.
     */
    constructor() {
        if (!instance) {
            instance = this;
        }

        // Flag to keep track of initialisation status of globals object
        this.initialised = false;

        return instance;
    }

    /**
     * Format error message appropriately for SEA vs non-SEA apps
     *
     * @param {Error} err - The error object
     * @returns {string} Formatted error message
     */
    getErrorMessage(err) {
        return getErrorMessage(this, err);
    }

    /**
     * Initializes the Settings object with configuration from the environment and config files.
     * Sets up logging, database connections, MQTT clients, and other application services.
     *
     * @returns {Promise<Settings>} A promise that resolves to the singleton instance of the Settings class after initialization.
     */
    async init() {
        // Initialize the SEA wrapper module
        await sea.initialize();

        // Utility functions
        this.checkFileExistsSync = checkFileExistsSync;
        this.sleep = sleep;
        this.isRunningInDocker = isRunningInDocker;

        // App info (version, base path)
        await initAppInfo(this);

        // Command line parameters
        initCommandLine(this);

        // Config loader
        await initConfig(this);

        // Are we running as standalone app or not?
        this.isSea = sea.isSea();

        // Set up array for storing app ids and names
        this.appNames = [];

        // Logging
        initLogging(this);

        // Are there New Relic account name(s), API key(s) and account ID(s) specified on the command line?
        // There must be the same number of each specified!
        // If so, replace any info from the config file with data from command line options
        if (
            this.options?.newRelicAccountName?.length > 0 &&
            this.options?.newRelicApiKey?.length > 0 &&
            this.options?.newRelicAccountId?.length > 0 &&
            this.options?.newRelicAccountName?.length === this.options?.newRelicApiKey?.length &&
            this.options?.newRelicApiKey?.length === this.options?.newRelicAccountId?.length
        ) {
            this.config['Butler-SOS'].thirdPartyToolsCredentials.newRelic = [];

            for (let index = 0; index < this.options.newRelicApiKey.length; index += 1) {
                const accountName = this.options.newRelicAccountName[index];
                const accountId = this.options.newRelicAccountId[index];
                const insertApiKey = this.options.newRelicApiKey[index];

                this.config['Butler-SOS'].thirdPartyToolsCredentials.newRelic.push({
                    accountName,
                    accountId,
                    insertApiKey,
                });
            }
        } else if (
            this.options?.newRelicAccountName?.length > 0 ||
            this.options?.newRelicApiKey?.length > 0 ||
            this.options?.newRelicAccountId?.length > 0
        ) {
            this.logger.error(
                'Incorrect command line parameters: Number of New Relic account names/IDs/API keys must match.'
            );
            process.exit(1);
        }

        // Verbose: Show what New Relic account names/API keys/account IDs have been defined (on command line or in config file)
        this.logger.verbose(
            `New Relic account names/API keys/account IDs (via command line or config file): ${JSON.stringify(
                this.config['Butler-SOS'].thirdPartyToolsCredentials.newRelic,
                null,
                2
            )}`
        );

        // Get certificate file paths for QRS connection
        const filename = fileURLToPath(import.meta.url);
        const dirname = upath.dirname(filename);
        this.certPath = upath.resolve(dirname, this.config.get('Butler-SOS.cert.clientCert'));
        this.keyPath = upath.resolve(dirname, this.config.get('Butler-SOS.cert.clientCertKey'));
        this.caPath = upath.resolve(dirname, this.config.get('Butler-SOS.cert.clientCertCA'));

        // UDP servers and queue managers
        initUdp(this);

        // InfluxDB
        await initInfluxDBClient(this);

        // ------------------------------------
        // Create MQTT client object and connect to MQTT broker
        // Only do this if MQTT is enabled
        // ------------------------------------
        if (this.config.get('Butler-SOS.mqttConfig.enable') === true) {
            this.mqttClient = mqtt.connect({
                port: this.config.get('Butler-SOS.mqttConfig.brokerPort'),
                host: this.config.get('Butler-SOS.mqttConfig.brokerHost'),
            });
        }

        // Anon telemetry reporting
        this.hostInfo = await initHostInfo(this);

        // Indicate that we have finished initialising
        this.initialised = true;

        this.logger.verbose('GLOBALS: Init done');

        return instance;
    }

    /**
     * Initializes the InfluxDB connection based on configuration settings.
     *
     * @returns {Promise<void>} A promise that resolves when InfluxDB is initialized.
     */
    async initInfluxDB() {
        return initInfluxDB(this);
    }

    /**
     * Initializes host information for telemetry.
     *
     * @returns {Promise<object | null>} A promise that resolves to the host information object or null if an error occurs.
     */
    async initHostInfo() {
        return initHostInfo(this);
    }

    /**
     * Detects if Butler SOS is running inside a Docker container.
     *
     * @returns {boolean} True if running in Docker, false otherwise
     */
    static isRunningInDocker() {
        return isRunningInDocker();
    }

    /**
     * Checks if a file exists at the specified file path.
     *
     * @param {string} filepath - Path to the file to check
     * @returns {boolean} True if the file exists, false otherwise
     */
    static checkFileExistsSync(filepath) {
        return checkFileExistsSync(filepath);
    }

    /**
     * Creates a Promise that resolves after a specified time in milliseconds.
     *
     * @param {number} ms - The number of milliseconds to sleep
     * @returns {Promise} A promise that resolves after the specified delay
     */
    static sleep(ms) {
        return sleep(ms);
    }
}

export default new Settings();
