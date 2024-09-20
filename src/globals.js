import upath from 'path';
import dgram from 'dgram';
import os from 'os';
import crypto from 'crypto';
import mqtt from 'mqtt';
import fs from 'fs-extra';
import winston from 'winston';
import 'winston-daily-rotate-file';
import si from 'systeminformation';
import { readFileSync } from 'fs';
import Influx from 'influx';
import { Command, Option } from 'commander';
import { InfluxDB, HttpError, DEFAULT_WriteOptions } from '@influxdata/influxdb-client';
import { OrgsAPI, BucketsAPI } from '@influxdata/influxdb-client-apis';
import { fileURLToPath } from 'url';

import { getServerTags } from './lib/servertags.js';
import { UdpEvents } from './lib/udp-event.js';

let instance = null;

class Settings {
    constructor() {
        if (!instance) {
            instance = this;
        }

        // Flag to keep track of initialisation status of globals object
        this.initialised = false;

        return instance;
    }

    async init() {
        // Get app version from package.json file
        const filenamePackage = `./package.json`;
        let a;
        let b;
        let c;
        // Are we running as a packaged app?
        if (process.pkg) {
            // Get path to JS file
            a = process.pkg.defaultEntrypoint;

            // Strip off the filename
            b = upath.dirname(a);

            // Add path to package.json file
            c = upath.join(b, filenamePackage);

            // Set base path of the executable
            this.appBasePath = upath.join(b);
        } else {
            // Get path to JS file
            a = fileURLToPath(import.meta.url);

            // Strip off the filename
            b = upath.dirname(a);

            // Add path to package.json file
            c = upath.join(b, '..', filenamePackage);

            // Set base path of the executable
            this.appBasePath = upath.join(b, '..');
        }

        const { version } = JSON.parse(readFileSync(c));
        this.appVersion = version;

        // Make copy of influxdb client
        const InfluxDB2 = InfluxDB;

        // Command line parameters
        const program = new Command();
        program
            .version(this.appVersion)
            .name('butler-sos')
            .description(
                'Butler SenseOps Stats ("Butler-SOS") is a tool publishing operational Qlik Sense metrics to InfluxDB, Prometheus, New Relic and other destinations.\nUser events and log events can be forwarded from Sense to Butler SOS and then acted upon there. Events can be stored in InfluxDB and sent to New Relic.\nAdd Grafana for great looking dashboards and you get real-time monitoring of what happens inside a Qlik Sense environment.\n\nMore info at https://butler-sos.ptarmiganlabs.com'
            )
            .option('-c, --configfile <file>', 'path to config file')
            .addOption(
                new Option('-l, --loglevel <level>', 'log level').choices([
                    'error',
                    'warn',
                    'info',
                    'verbose',
                    'debug',
                    'silly',
                ])
            )
            .option(
                '--new-relic-account-name  <name...>',
                'New Relic account name. Used within Butler SOS to differentiate between different target New Relic accounts'
            )
            .option('--new-relic-api-key <key...>', 'insert API key to use with New Relic')
            .option('--new-relic-account-id <id...>', 'New Relic account ID')

            .option('--skip-config-verification', 'Disable config file verification', false);

        // Parse command line params
        program.parse(process.argv);
        this.options = program.opts();

        // Utility functions
        this.checkFileExistsSync = Settings.checkFileExistsSync;
        this.sleep = Settings.sleep;

        // Is there a config file specified on the command line?
        let configFileOption;
        this.configFile = null;
        let configFilePath;
        let configFileBasename;
        let configFileExtension;
        if (this.options.configfile && this.options.configfile.length > 0) {
            configFileOption = this.options.configfile;

            // Full path to config file
            this.configFile = upath.resolve(this.options.configfile);
            configFilePath = upath.dirname(this.configFile);
            configFileExtension = upath.extname(this.configFile);
            configFileBasename = upath.basename(this.configFile, configFileExtension);

            if (configFileExtension.toLowerCase() !== '.yaml') {
                console.log('Error: Config file extension must be yaml');
                process.exit(1);
            }

            if (this.checkFileExistsSync(this.options.configfile)) {
                process.env.NODE_CONFIG_DIR = configFilePath;
                process.env.NODE_ENV = configFileBasename;
            } else {
                console.log('Error: Specified config file does not exist');
                process.exit(1);
            }
        } else {
            // Get value of env variable NODE_ENV
            const env = process.env.NODE_ENV;

            // Get path to config file
            const filename = fileURLToPath(import.meta.url);
            const dirname = upath.dirname(filename);
            this.configFile = upath.resolve(dirname, `./config/${env}.yaml`);
        }

        this.config = (await import('config')).default;

        this.execPath = this.isPkg ? upath.dirname(process.execPath) : process.cwd();

        // Are we running as standalone app or not?
        this.isPkg = typeof process.pkg !== 'undefined';
        if (this.isPkg && configFileOption === undefined) {
            // Show help if running as standalone app and mandatory options (e.g. config file) are not specified
            program.help({ error: true });
        }

        // Is there a log level file specified on the command line?
        if (this.options.loglevel && this.options.loglevel.length > 0) {
            this.config['Butler-SOS'].logLevel = this.options.loglevel;
        }

        // Set up array for storing app ids and names
        this.appNames = [];

        // Set up logger with timestamps and colors, and optional logging to disk file
        this.logTransports = [];

        this.logTransports.push(
            new winston.transports.Console({
                name: 'console',
                level: this.config.get('Butler-SOS.logLevel'),
                format: winston.format.combine(
                    winston.format.errors({ stack: true }),
                    winston.format.timestamp(),
                    winston.format.colorize(),
                    winston.format.simple(),
                    winston.format.printf(
                        (info) => `${info.timestamp} ${info.level}: ${info.message}`
                    )
                ),
            })
        );

        if (
            this.config['Butler-SOS'].logLevel === 'verbose' ||
            this.config['Butler-SOS'].logLevel === 'debug' ||
            this.config['Butler-SOS'].logLevel === 'silly'
        ) {
            // We don't have a logging object yet, so use plain console.log

            // Are we in a packaged app?
            if (this.isPkg) {
                console.log(`Running in packaged app. Executable path: ${this.execPath}`);
            } else {
                console.log(
                    `Running in non-packaged environment. Executable path: ${this.execPath}`
                );
            }

            console.log(
                `Log file directory: ${upath.join(this.execPath, this.config.get('Butler-SOS.logDirectory'))}`
            );

            console.log(`upath.dirname(process.execPath): ${upath.dirname(process.execPath)}`);

            console.log(`process.cwd(): ${process.cwd()}`);
        }

        if (this.config.get('Butler-SOS.fileLogging')) {
            this.logTransports.push(
                new winston.transports.DailyRotateFile({
                    dirname: upath.join(this.execPath, this.config.get('Butler-SOS.logDirectory')),
                    filename: 'butler-sos.%DATE%.log',
                    level: this.config.get('Butler-SOS.logLevel'),
                    datePattern: 'YYYY-MM-DD',
                    maxFiles: '30d',
                })
            );
        }

        this.logger = winston.createLogger({
            transports: this.logTransports,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
            ),
        });

        // Show contents of environment variables controlling config file location and name
        this.logger.debug(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR}`);
        this.logger.debug(`NODE_ENV: ${process.env.NODE_ENV}`);

        // Output config file name and path to log
        this.logger.info(`Using config file: ${this.configFile}`);

        // Function to get current logging level
        this.getLoggingLevel = () =>
            this.logTransports.find((transport) => transport.name === 'console').level;

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

        // ------------------------------------
        // User activity UDP server
        this.udpServerUserActivity = {};

        try {
            this.udpServerUserActivity.host = this.config.get(
                'Butler-SOS.userEvents.udpServerConfig.serverHost'
            );

            // Prepare to listen on port X for incoming UDP connections regarding user activity events
            this.udpServerUserActivity.socket = dgram.createSocket({
                type: 'udp4',
                reuseAddr: true,
            });

            this.udpServerUserActivity.portUserActivity = this.config.get(
                'Butler-SOS.userEvents.udpServerConfig.portUserActivityEvents'
            );
        } catch (err) {
            this.logger.error(`CONFIG: Setting up UDP user activity listener: ${err}`);
        }

        // ------------------------------------
        // Log events UDP server
        this.udpServerLogEvents = {};

        try {
            this.udpServerLogEvents.host = this.config.get(
                'Butler-SOS.logEvents.udpServerConfig.serverHost'
            );

            // Prepare to listen on port X for incoming UDP connections regarding user activity events
            this.udpServerLogEvents.socket = dgram.createSocket({
                type: 'udp4',
                reuseAddr: true,
            });

            this.udpServerLogEvents.port = this.config.get(
                'Butler-SOS.logEvents.udpServerConfig.portLogEvents'
            );
        } catch (err) {
            this.logger.error(`CONFIG: Setting up UDP log events listener: ${err}`);
        }

        // ------------------------------------
        // Track user events and log event counts
        if (this.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
            this.udpEvents = new UdpEvents(this.logger);
        } else {
            this.udpEvents = null;
        }

        // ------------------------------------
        // Track rejected user and log events
        if (this.config.get('Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') === true) {
            this.rejectedEvents = new UdpEvents(this.logger);
        } else {
            this.rejectedEvents = null;
        }

        // ------------------------------------
        // Get info on what servers to monitor
        this.serverList = this.config.get('Butler-SOS.serversToMonitor.servers');

        // Get list of standard and user configurable tags
        // ..begin with standard tags
        const tagValues = ['host', 'server_name', 'server_description'];

        // ..check if there are any extra tags for this Butler SOS instance that should be sent to InfluxDB
        if (
            this.config.has('Butler-SOS.serversToMonitor.serverTagsDefinition') &&
            this.config.get('Butler-SOS.serversToMonitor.serverTagsDefinition') !== null
        ) {
            // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
            this.config.get('Butler-SOS.serversToMonitor.serverTagsDefinition').forEach((entry) => {
                this.logger.debug(
                    `CONFIG: Setting up new Influx database: Found server tag : ${entry}`
                );

                tagValues.push(entry);
            });
        }

        // Add tags for log events
        const tagValuesLogEvent = tagValues.slice();
        tagValuesLogEvent.push('level');
        tagValuesLogEvent.push('source');
        tagValuesLogEvent.push('log_row');
        tagValuesLogEvent.push('subsystem');
        tagValuesLogEvent.push('user_full');
        tagValuesLogEvent.push('user_directory');
        tagValuesLogEvent.push('user_id');
        tagValuesLogEvent.push('task_id');
        tagValuesLogEvent.push('task_name');
        tagValuesLogEvent.push('app_id');
        tagValuesLogEvent.push('app_name');
        tagValuesLogEvent.push('result_code');
        tagValuesLogEvent.push('windows_user');
        tagValuesLogEvent.push('engine_exe_version');

        // Performance log event tags
        tagValuesLogEvent.push('method');
        tagValuesLogEvent.push('object_type');
        tagValuesLogEvent.push('proxy_session_id');
        tagValuesLogEvent.push('session_id');
        tagValuesLogEvent.push('event_activity_source');
        tagValuesLogEvent.push('object_id');

        // Check if there are any extra log event tags in the config file
        if (
            this.config.has('Butler-SOS.logEvents.tags') &&
            this.config.get('Butler-SOS.logEvents.tags') !== null
        ) {
            this.config.get('Butler-SOS.logEvents.tags').forEach((entry) => {
                this.logger.debug(
                    `CONFIG: Setting up new Influx database: Found log event tag in config file: ${JSON.stringify(
                        entry
                    )}`
                );

                tagValuesLogEvent.push(entry.name);
            });
        }

        // Add tags for log events categories, if enabled and configured
        if (
            this.config.has('Butler-SOS.logEvents.categorise.enable') &&
            this.config.get('Butler-SOS.logEvents.categorise.enable') === true &&
            this.config.has('Butler-SOS.logEvents.categorise.rules')
        ) {
            // Add tags from Butler-SOS.logEvents.categorise.rules[].category[], where each object has properties 'name' and 'value'
            this.config.get('Butler-SOS.logEvents.categorise.rules').forEach((rule) => {
                rule.category.forEach((category) => {
                    tagValuesLogEvent.push(category.name);
                });
            });

            // Add default rule categories, if enabled
            if (
                this.config.has('Butler-SOS.logEvents.categorise.ruleDefault.enable') &&
                this.config.get('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true &&
                this.config.has('Butler-SOS.logEvents.categorise.ruleDefault.category')
            ) {
                this.config
                    .get('Butler-SOS.logEvents.categorise.ruleDefault.category')
                    .forEach((category) => {
                        tagValuesLogEvent.push(category.name);
                    });
            }
        }

        // Create tags for user sessions
        const tagValuesUserProxySessions = tagValues.slice();
        tagValuesUserProxySessions.push('user_session_virtual_proxy');
        tagValuesUserProxySessions.push('user_session_host');

        // Show Influxdb config
        if (this.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            this.logger.info(`CONFIG: Influxdb enabled: true`);
            this.logger.info(
                `CONFIG: Influxdb host IP: ${this.config.get('Butler-SOS.influxdbConfig.host')}`
            );
            this.logger.info(
                `CONFIG: Influxdb host port: ${this.config.get('Butler-SOS.influxdbConfig.port')}`
            );
            this.logger.info(
                `CONFIG: Influxdb version: ${this.config.get('Butler-SOS.influxdbConfig.version')}`
            );

            // Version specific configs
            if (this.config.get('Butler-SOS.influxdbConfig.version') === 1) {
                this.logger.info(
                    `CONFIG: Influxdb db name: ${this.config.get('Butler-SOS.influxdbConfig.v1Config.dbName')}`
                );
                this.logger.info(
                    `CONFIG: Influxdb retention policy: ${this.config.get('Butler-SOS.influxdbConfig.v1Config.retentionPolicy.name')}`
                );
            } else if (this.config.get('Butler-SOS.influxdbConfig.version') === 2) {
                this.logger.info(
                    `CONFIG: Influxdb organisation: ${this.config.get('Butler-SOS.influxdbConfig.v2Config.org')}`
                );
                this.logger.info(
                    `CONFIG: Influxdb bucket name: ${this.config.get('Butler-SOS.influxdbConfig.v2Config.bucket')}`
                );
                this.logger.info(
                    `CONFIG: Influxdb retention policy duration: ${this.config.get('Butler-SOS.influxdbConfig.v2Config.retentionDuration')}`
                );
            } else {
                this.logger.error(
                    `CONFIG: Influxdb version ${this.config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
                );
            }
        } else {
            this.logger.info(`CONFIG: Influxdb enabled: false`);
        }

        this.influxWriteApi = [];
        if (this.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            if (this.config.get('Butler-SOS.influxdbConfig.version') === 1) {
                // Set up Influxdb v1 client
                this.influx = new Influx.InfluxDB({
                    host: this.config.get('Butler-SOS.influxdbConfig.host'),
                    port: this.config.get('Butler-SOS.influxdbConfig.port'),
                    database: this.config.get('Butler-SOS.influxdbConfig.v1Config.dbName'),
                    username: `${
                        this.config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                            ? this.config.get('Butler-SOS.influxdbConfig.v1Config.auth.username')
                            : ''
                    }`,
                    password: `${
                        this.config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                            ? this.config.get('Butler-SOS.influxdbConfig.v1Config.auth.password')
                            : ''
                    }`,
                    schema: [
                        {
                            measurement: 'sense_server',
                            fields: {
                                version: Influx.FieldType.STRING,
                                started: Influx.FieldType.STRING,
                                uptime: Influx.FieldType.STRING,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'mem',
                            fields: {
                                comitted: Influx.FieldType.INTEGER,
                                allocated: Influx.FieldType.INTEGER,
                                free: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'apps',
                            fields: {
                                active_docs_count: Influx.FieldType.INTEGER,
                                loaded_docs_count: Influx.FieldType.INTEGER,
                                in_memory_docs_count: Influx.FieldType.INTEGER,
                                active_docs: Influx.FieldType.STRING,
                                active_docs_names: Influx.FieldType.STRING,
                                active_session_docs_names: Influx.FieldType.STRING,
                                loaded_docs: Influx.FieldType.STRING,
                                loaded_docs_names: Influx.FieldType.STRING,
                                loaded_session_docs_names: Influx.FieldType.STRING,
                                in_memory_docs: Influx.FieldType.STRING,
                                in_memory_docs_names: Influx.FieldType.STRING,
                                in_memory_session_docs_names: Influx.FieldType.STRING,
                                calls: Influx.FieldType.INTEGER,
                                selections: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'cpu',
                            fields: {
                                total: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'session',
                            fields: {
                                active: Influx.FieldType.INTEGER,
                                total: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'users',
                            fields: {
                                active: Influx.FieldType.INTEGER,
                                total: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'cache',
                            fields: {
                                hits: Influx.FieldType.INTEGER,
                                lookups: Influx.FieldType.INTEGER,
                                added: Influx.FieldType.INTEGER,
                                replaced: Influx.FieldType.INTEGER,
                                bytes_added: Influx.FieldType.INTEGER,
                            },
                            tags: tagValues,
                        },
                        {
                            measurement: 'log_event',
                            fields: {
                                message: Influx.FieldType.STRING,
                                exception_message: Influx.FieldType.STRING,
                                app_name: Influx.FieldType.STRING,
                                app_id: Influx.FieldType.STRING,
                                execution_id: Influx.FieldType.STRING,
                                command: Influx.FieldType.STRING,
                                result_code: Influx.FieldType.STRING,
                                origin: Influx.FieldType.STRING,
                                context: Influx.FieldType.STRING,
                                session_id: Influx.FieldType.STRING,
                                raw_event: Influx.FieldType.STRING,

                                // engine performance fields
                                process_time: Influx.FieldType.FLOAT,
                                work_time: Influx.FieldType.FLOAT,
                                lock_time: Influx.FieldType.FLOAT,
                                validate_time: Influx.FieldType.FLOAT,
                                traverse_time: Influx.FieldType.FLOAT,
                                handle: Influx.FieldType.INTEGER,
                                net_ram: Influx.FieldType.INTEGER,
                                peak_ram: Influx.FieldType.INTEGER,
                            },
                            tags: tagValuesLogEvent,
                        },
                        {
                            measurement: 'butlersos_memory_usage',
                            fields: {
                                heap_used: Influx.FieldType.FLOAT,
                                heap_total: Influx.FieldType.FLOAT,
                                external: Influx.FieldType.FLOAT,
                                process_memory: Influx.FieldType.FLOAT,
                            },
                            tags: ['butler_sos_instance', 'version'],
                        },
                        {
                            measurement: 'user_session_summary',
                            fields: {
                                session_count: Influx.FieldType.INTEGER,
                                session_user_id_list: Influx.FieldType.STRING,
                            },
                            tags: tagValuesUserProxySessions,
                        },
                        {
                            measurement: 'user_session_list',
                            fields: {
                                session_user_id_list: Influx.FieldType.STRING,
                            },
                            tags: tagValuesUserProxySessions,
                        },
                        // {
                        //     measurement: 'user_events',
                        //     fields: {
                        //         userFull: Influx.FieldType.STRING,
                        //         userId: Influx.FieldType.STRING
                        //     },
                        //     tags: ['host', 'event_action', 'userFull', 'userDirectory', 'userId', 'origin']
                        // },
                    ],
                });
            } else if (this.config.get('Butler-SOS.influxdbConfig.version') === 2) {
                // Set up Influxdb v2 client
                const url = `http://${this.config.get('Butler-SOS.influxdbConfig.host')}:${this.config.get(
                    'Butler-SOS.influxdbConfig.port'
                )}`;
                const token = this.config.get('Butler-SOS.influxdbConfig.v2Config.token');

                try {
                    this.influx = new InfluxDB2({ url, token });
                } catch (err) {
                    this.logger.error(`INFLUXDB2 INIT: Error creating InfluxDB 2 client: ${err}`);
                    this.logger.error(`INFLUXDB2 INIT: Exiting.`);
                }
            } else {
                this.logger.error(
                    `CONFIG: Influxdb version ${this.config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
                );
            }
        }

        // Now initialise InfluxDB
        await this.initInfluxDB();

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

        /*
        Following might be needed for conecting to older Mosquitto versions
        var mqttClient  = mqtt.connect('mqtt://<IP of MQTT server>', {
            protocolId: 'MQIsdp',
            protocolVersion: 3
        });
        */

        // Anon telemetry reporting
        this.hostInfo = await this.initHostInfo();

        // Indicate that we have finished initialising
        this.initialised = true;

        this.logger.verbose('GLOBALS: Init done');

        return instance;
    }

    // Static function to check if a file exists
    static checkFileExistsSync(filepath) {
        let flag = true;
        try {
            fs.accessSync(filepath, fs.constants.F_OK);
        } catch (e) {
            flag = false;
        }
        return flag;
    }

    // Static sleep function
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Static function to check if Butler is running in a Docker container
    static isRunningInDocker() {
        try {
            fs.accessSync('/.dockerenv');
            return true;
        } catch (_) {
            return false;
        }
    }

    async initInfluxDB() {
        let enableInfluxdb = false;

        // Handle InfluxDB v1
        if (this.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            const dbName = this.config.get('Butler-SOS.influxdbConfig.v1Config.dbName');

            if (
                this.influx &&
                this.config.get('Butler-SOS.influxdbConfig.enable') === true &&
                dbName?.length > 0
            ) {
                enableInfluxdb = true;
            }

            if (enableInfluxdb) {
                try {
                    const names = await this.influx.getDatabaseNames();
                    if (!names.includes(dbName)) {
                        // Create new database
                        try {
                            const res = await this.influx.createDatabase(dbName);
                            this.logger.info(`CONFIG: Created new InfluxDB v1 database: ${dbName}`);

                            const newPolicy = this.config.get(
                                'Butler-SOS.influxdbConfig.v1Config.retentionPolicy'
                            );

                            // Create new default retention policy
                            try {
                                const res2 = await this.influx.createRetentionPolicy(
                                    newPolicy.name,
                                    {
                                        database: dbName,
                                        duration: newPolicy.duration,
                                        replication: 1,
                                        isDefault: true,
                                    }
                                );

                                this.logger.info(
                                    `CONFIG: Created new InfluxDB v1 retention policy: ${newPolicy.name}`
                                );
                            } catch (err) {
                                this.logger.error(
                                    `CONFIG: Error creating new InfluxDB v1 retention policy "${newPolicy.name}"! ${err.stack}`
                                );
                            }
                        } catch (err) {
                            this.logger.error(
                                `CONFIG: Error creating new InfluxDB v1 database "${dbName}"! ${err.stack}`
                            );
                        }
                    } else {
                        this.logger.info(`CONFIG: Found InfluxDB v1 database: ${dbName}`);
                    }
                } catch (err) {
                    this.logger.error(
                        `CONFIG: Error getting list of InfluxDB v1 databases. ${err.stack}`
                    );
                }
            }
        } else if (this.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            // Get config
            const org = this.config.get('Butler-SOS.influxdbConfig.v2Config.org');
            const bucketName = this.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
            const description = this.config.get('Butler-SOS.influxdbConfig.v2Config.description');
            const token = this.config.get('Butler-SOS.influxdbConfig.v2Config.token');
            const retentionDuration = this.config.get(
                'Butler-SOS.influxdbConfig.v2Config.retentionDuration'
            );

            if (
                this.influx &&
                this.config.get('Butler-SOS.influxdbConfig.enable') === true &&
                org?.length > 0 &&
                bucketName?.length > 0 &&
                token?.length > 0 &&
                retentionDuration?.length > 0
            ) {
                enableInfluxdb = true;
            }

            if (enableInfluxdb) {
                let orgID;

                try {
                    // Get organisation by name
                    const orgsAPI = new OrgsAPI(this.influx);
                    const organizations = await orgsAPI.getOrgs({ org });
                    if (!organizations || !organizations.orgs || !organizations.orgs.length) {
                        this.logger.error(`INFLUXDB2: No organization named "${org}" found!`);
                    }
                    orgID = organizations.orgs[0].id;
                    this.logger.info(
                        `INFLUXDB2: Using organization "${org}" identified by "${orgID}"`
                    );
                } catch (err) {
                    this.logger.error(`INFLUXDB2: Error getting organisation: ${err}`);
                }

                try {
                    // Get buckets by name
                    const bucketsAPI = new BucketsAPI(this.influx);
                    try {
                        const buckets = await bucketsAPI.getBuckets({ orgID, name: bucketName });
                        if (buckets && buckets.buckets && buckets.buckets.length > 0) {
                            const bucketID = buckets.buckets[0].id;
                            this.logger.info(
                                `INFLUXDB2: Bucket named "${bucketName}" already exists, bucket ID="${bucketID}"`
                            );
                        }
                    } catch (e) {
                        if (e instanceof HttpError && e.statusCode === 404) {
                            // Bucket not found. Let's create it
                            this.logger.info(
                                `INFLUXDB2: Bucket named "${bucketName}" not found, creating it...`
                            );

                            // creates a bucket, entity properties are specified in the "body" property
                            const newBucket = await bucketsAPI.postBuckets({
                                body: {
                                    orgID,
                                    name: bucketName,
                                    description,
                                    rp: retentionDuration,
                                },
                            });

                            this.logger.verbose(
                                `INFLUXDB2: New bucket: ${JSON.stringify(
                                    newBucket,
                                    (key, value) => (key === 'links' ? undefined : value),
                                    2
                                )}`
                            );
                        } else {
                            throw e;
                        }
                    }
                } catch (err) {
                    this.logger.error(`INFLUXDB2: Error getting bucket: ${err}`);
                }

                // Get write API

                // Create array of per-server writeAPI objects
                // Each object has two properties: host and writeAPI, where host can be used as key later on
                this.serverList.forEach((server) => {
                    // Get per-server tags
                    const tags = getServerTags(this.logger, server);

                    // advanced write options
                    const writeOptions = {
                        /* the maximum points/lines to send in a single batch to InfluxDB server */
                        // batchSize: flushBatchSize + 1, // don't let automatically flush data

                        /* default tags to add to every point */
                        defaultTags: tags,

                        /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
                        flushInterval: 5000,

                        /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
                        // maxBufferLines: 30_000,

                        /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
                        maxRetries: 2, // do not retry writes

                        // ... there are more write options that can be customized, see
                        // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
                        // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
                    };

                    try {
                        const serverWriteApi = this.influx.getWriteApi(
                            org,
                            bucketName,
                            'ns',
                            writeOptions
                        );

                        // Save to global variable, using hostNamre as key
                        this.influxWriteApi.push({
                            serverName: server.serverName,
                            writeAPI: serverWriteApi,
                        });
                    } catch (err) {
                        this.logger.error(`INFLUXDB2: Error getting write API: ${err}`);
                    }
                });
            }
        }
    }

    async initHostInfo() {
        try {
            const siCPU = await si.cpu();
            const siSystem = await si.system();
            const siMem = await si.mem();
            const siOS = await si.osInfo();
            const siDocker = await si.dockerInfo();
            const siNetwork = await si.networkInterfaces();
            const siNetworkDefault = await si.networkInterfaceDefault();

            const defaultNetworkInterface = siNetworkDefault;

            const networkInterface = siNetwork.filter(
                (item) => item.iface === defaultNetworkInterface
            );

            const idSrc = networkInterface[0].mac + networkInterface[0].ip4 + siSystem.uuid;
            const salt = networkInterface[0].mac;
            const hash = crypto.createHmac('sha256', salt);
            hash.update(idSrc);

            // Get first 50 characters of hash
            const id = hash.digest('hex');

            const hostInfo = {
                id,
                isRunningInDocker: Settings.isRunningInDocker(),
                node: {
                    nodeVersion: process.version,
                    versions: process.versions,
                },
                os: {
                    platform: os.platform(),
                    release: os.release(),
                    version: os.version(),
                    arch: os.arch(),
                    cpuCores: os.cpus().length,
                    type: os.type(),
                    totalmem: os.totalmem(),
                },
                si: {
                    cpu: siCPU,
                    system: siSystem,
                    memory: {
                        total: siMem.total,
                    },
                    os: siOS,
                    network: siNetwork,
                    networkDefault: siNetworkDefault,
                    docker: siDocker,
                },
            };

            return hostInfo;
        } catch (err) {
            this.logger.error(`CONFIG: Getting host info: ${err}`);
            return null;
        }
    }
}

export default new Settings();
