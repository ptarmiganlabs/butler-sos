const path = require('path');
const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');

const mqtt = require('mqtt');
const fs = require('fs-extra');
const winston = require('winston');
require('winston-daily-rotate-file');
const si = require('systeminformation');
const { Command, Option } = require('commander');
const Influx = require('influx');
const { InfluxDB, HttpError, DEFAULT_WriteOptions } = require('@influxdata/influxdb-client');
const { OrgsAPI, BucketsAPI } = require('@influxdata/influxdb-client-apis');

const { getServerTags } = require('./lib/servertags');

const InfluxDB2 = InfluxDB;

const { Pool } = require('pg');

function checkFileExistsSync(filepath) {
    let flag = true;
    try {
        fs.accessSync(filepath, fs.constants.F_OK);
    } catch (e) {
        flag = false;
    }
    return flag;
}

// Get app version from package.json file
const appVersion = require('../package.json').version;

// Command line parameters
const program = new Command();
program
    .version(appVersion)
    .name('butler-sos')
    .description(
        'Butler SenseOps Stats ("Butler-SOS") is a microservice publishing operational Qlik Sense metrics to InfluxDB, Prometheus and New Relic.\nUser events and log events can be forwarded from Sense to Butler SOS and then acted upon there. Events can be stored in InfluxDB and sent to New Relic.\nAdd Grafana for great looking dashboards and you get real-time monitoring of what happens inside a Qlik Sense environment.'
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
const options = program.opts();

// Is there a config file specified on the command line?
let configFileOption;
let configFileExpanded;
let configFilePath;
let configFileBasename;
let configFileExtension = '.yaml';
if (options.configfile && options.configfile.length > 0) {
    configFileOption = options.configfile;
    configFileExpanded = path.resolve(options.configfile);
    configFilePath = path.dirname(configFileExpanded);
    configFileExtension = path.extname(configFileExpanded);
    configFileBasename = path.basename(configFileExpanded, configFileExtension);

    if (configFileExtension.toLowerCase() !== '.yaml') {
        // eslint-disable-next-line no-console
        console.log('Error: Config file extension must be yaml');
        process.exit(1);
    }

    if (checkFileExistsSync(options.configfile)) {
        process.env.NODE_CONFIG_DIR = configFilePath;
        process.env.NODE_ENV = configFileBasename;
    } else {
        // eslint-disable-next-line no-console
        console.log('Error: Specified config file does not exist');
        process.exit(1);
    }
} else {
    // Set default values of environment variables controlling config file location and name
    if (process.env.NODE_CONFIG_DIR === undefined) {
        process.env.NODE_CONFIG_DIR = path.join(process.cwd(), 'config');
    }

    if (process.env.NODE_ENV === undefined) {
        process.env.NODE_ENV = 'production';
    }
}

// Set global variable conttaining the name and full path of the config file
const configFile = path.join(
    process.env.NODE_CONFIG_DIR,
    `${process.env.NODE_ENV}${configFileExtension}`
);

// Are we running as standalone app or not?
const isPkg = typeof process.pkg !== 'undefined';
if (isPkg && configFileOption === undefined) {
    // Show help if running as standalone app and mandatory options (e.g. config file) are not specified
    program.help({ error: true });
}

// eslint-disable-next-line import/order
const config = require('config');

// Is there a log level file specified on the command line?
if (options.loglevel && options.loglevel.length > 0) {
    config['Butler-SOS'].logLevel = options.loglevel;
}

// Set up array for storing app ids and names
const appNames = [];

// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

logTransports.push(
    new winston.transports.Console({
        name: 'console',
        level: config.get('Butler-SOS.logLevel'),
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
    })
);

if (config.get('Butler-SOS.fileLogging')) {
    logTransports.push(
        new winston.transports.DailyRotateFile({
            dirname: path.join(process.cwd(), config.get('Butler-SOS.logDirectory')),
            filename: 'butler-sos.%DATE%.log',
            level: config.get('Butler-SOS.logLevel'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
        })
    );
}

const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

// Show contents of environment variables controlling config file location and name
logger.debug(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR}`);
logger.debug(`NODE_ENV: ${process.env.NODE_ENV}`);

// Output config file name and path to log
logger.info(`Using config file: ${configFile}`);

// Function to get current logging level
const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

// Are there New Relic account name(s), API key(s) and account ID(s) specified on the command line?
// There must be the same number of each specified!
// If so, replace any info from the config file with data from command line options
if (
    options?.newRelicAccountName?.length > 0 &&
    options?.newRelicApiKey?.length > 0 &&
    options?.newRelicAccountId?.length > 0 &&
    options?.newRelicAccountName?.length === options?.newRelicApiKey?.length &&
    options?.newRelicApiKey?.length === options?.newRelicAccountId?.length
) {
    config['Butler-SOS'].thirdPartyToolsCredentials.newRelic = [];

    for (let index = 0; index < options.newRelicApiKey.length; index += 1) {
        const accountName = options.newRelicAccountName[index];
        const accountId = options.newRelicAccountId[index];
        const insertApiKey = options.newRelicApiKey[index];

        config['Butler-SOS'].thirdPartyToolsCredentials.newRelic.push({
            accountName,
            accountId,
            insertApiKey,
        });
    }
} else if (
    options?.newRelicAccountName?.length > 0 ||
    options?.newRelicApiKey?.length > 0 ||
    options?.newRelicAccountId?.length > 0
) {
    logger.error(
        'Incorrect command line parameters: Number of New Relic account names/IDs/API keys must match.'
    );
    process.exit(1);
}

// ------------------------------------
// User activity UDP server
const udpServerUserActivity = {};

try {
    udpServerUserActivity.host = config.get('Butler-SOS.userEvents.udpServerConfig.serverHost');

    // Prepare to listen on port X for incoming UDP connections regarding user activity events
    udpServerUserActivity.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
    });

    udpServerUserActivity.portUserActivity = config.get(
        'Butler-SOS.userEvents.udpServerConfig.portUserActivityEvents'
    );
} catch (err) {
    logger.error(`CONFIG: Setting up UDP user activity listener: ${err}`);
}

// ------------------------------------
// Log events UDP server
const udpServerLogEvents = {};

try {
    udpServerLogEvents.host = config.get('Butler-SOS.logEvents.udpServerConfig.serverHost');

    // Prepare to listen on port X for incoming UDP connections regarding user activity events
    udpServerLogEvents.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
    });

    udpServerLogEvents.port = config.get('Butler-SOS.logEvents.udpServerConfig.portLogEvents');
} catch (err) {
    logger.error(`CONFIG: Setting up UDP log events listener: ${err}`);
}

// ------------------------------------
// Get info on what servers to monitor
const serverList = config.get('Butler-SOS.serversToMonitor.servers');

// Only set up connection pool for accessing Qlik Sense log db if that feature is enabled
let pgPool;
if (config.get('Butler-SOS.logdb.enable') === true) {
    // Set up connection pool for accessing Qlik Sense log db
    pgPool = new Pool({
        host: config.get('Butler-SOS.logdb.host'),
        database: 'QLogs',
        user: config.get('Butler-SOS.logdb.qlogsReaderUser'),
        password: config.get('Butler-SOS.logdb.qlogsReaderPwd'),
        port: config.get('Butler-SOS.logdb.port'),
    });

    // the pool will emit an error on behalf of any idle clients
    // it contains if a backend error or network partition happens
    // eslint-disable-next-line no-unused-vars
    pgPool.on('error', (err, client) => {
        logger.error(`CONFIG: Unexpected error on idle client: ${err}`);
        // process.exit(-1);
    });
}

// Get list of standard and user configurable tags
// ..begin with standard tags
const tagValues = ['host', 'server_name', 'server_description'];

// ..check if there are any extra tags for this Butler SOS instance that should be sent to InfluxDB
if (
    config.has('Butler-SOS.serversToMonitor.serverTagsDefinition') &&
    config.get('Butler-SOS.serversToMonitor.serverTagsDefinition') !== null
) {
    // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
    config.get('Butler-SOS.serversToMonitor.serverTagsDefinition').forEach((entry) => {
        logger.debug(`CONFIG: Setting up new Influx database: Found server tag : ${entry}`);

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

// Check if there are any extra log event tags in the config file
if (config.has('Butler-SOS.logEvents.tags') && config.get('Butler-SOS.logEvents.tags') !== null) {
    config.get('Butler-SOS.logEvents.tags').forEach((entry) => {
        logger.debug(
            `CONFIG: Setting up new Influx database: Found log event tag in config file: ${JSON.stringify(
                entry
            )}`
        );

        tagValuesLogEvent.push(entry.tag);
    });
}

// Create InfluxDB tags for data coming from log db
const tagValuesLogEventLogDb = tagValues.slice();
tagValuesLogEventLogDb.push('source_process');
tagValuesLogEventLogDb.push('log_level');

// Show Influxdb config
if (config.get('Butler-SOS.influxdbConfig.enable') === true) {
    logger.info(`CONFIG: Influxdb enabled: true`);
    logger.info(`CONFIG: Influxdb host IP: ${config.get('Butler-SOS.influxdbConfig.host')}`);
    logger.info(`CONFIG: Influxdb host port: ${config.get('Butler-SOS.influxdbConfig.port')}`);
    logger.info(`CONFIG: Influxdb version: ${config.get('Butler-SOS.influxdbConfig.version')}`);

    // Version specific configs
    if (config.get('Butler-SOS.influxdbConfig.version') === 1) {
        logger.info(
            `CONFIG: Influxdb db name: ${config.get('Butler-SOS.influxdbConfig.v1Config.dbName')}`
        );
        logger.info(
            `CONFIG: Influxdb retention policy: ${config.get('Butler-SOS.influxdbConfig.v1Config.retentionPolicy.name')}`
        );
    } else if (config.get('Butler-SOS.influxdbConfig.version') === 2) {
        logger.info(
            `CONFIG: Influxdb organisation: ${config.get('Butler-SOS.influxdbConfig.v2Config.org')}`
        );
        logger.info(
            `CONFIG: Influxdb bucket name: ${config.get('Butler-SOS.influxdbConfig.v2Config.bucket')}`
        );
        logger.info(
            `CONFIG: Influxdb retention policy duration: ${config.get('Butler-SOS.influxdbConfig.v2Config.retentionDuration')}`
        );
    } else {
        logger.error(
            `CONFIG: Influxdb version ${config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
        );
    }
} else {
    logger.info(`CONFIG: Influxdb enabled: false`);
}

// Set up Influxdb client
let influx;
let influxWriteApi = [];
if (config.get('Butler-SOS.influxdbConfig.enable') === true) {
    if (config.get('Butler-SOS.influxdbConfig.version') === 1) {
        // Set up Influxdb v1 client
        influx = new Influx.InfluxDB({
            host: config.get('Butler-SOS.influxdbConfig.host'),
            port: config.get('Butler-SOS.influxdbConfig.port'),
            database: config.get('Butler-SOS.influxdbConfig.v1Config.dbName'),
            username: `${
                config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                    ? config.get('Butler-SOS.influxdbConfig.v1Config.auth.username')
                    : ''
            }`,
            password: `${
                config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                    ? config.get('Butler-SOS.influxdbConfig.v1Config.auth.password')
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
                    measurement: 'log_event_logdb',
                    fields: {
                        message: Influx.FieldType.STRING,
                    },
                    tags: tagValuesLogEventLogDb,
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
    } else if (config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Set up Influxdb v2 client
        const url = `http://${config.get('Butler-SOS.influxdbConfig.host')}:${config.get(
            'Butler-SOS.influxdbConfig.port'
        )}`;
        const token = config.get('Butler-SOS.influxdbConfig.v2Config.token');

        try {
            influx = new InfluxDB2({ url, token });
        } catch (err) {
            logger.error(`INFLUXDB2 INIT: Error creating InfluxDB 2 client: ${err}`);
            logger.error(`INFLUXDB2 INIT: Exiting.`);
        }
    } else {
        logger.error(
            `CONFIG: Influxdb version ${config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
        );
    }
}

async function initInfluxDB() {
    let enableInfluxdb = false;

    // Handle InfluxDB v1
    if (config.get('Butler-SOS.influxdbConfig.version') === 1) {
        const dbName = config.get('Butler-SOS.influxdbConfig.v1Config.dbName');

        if (
            influx &&
            config.get('Butler-SOS.influxdbConfig.enable') === true &&
            dbName?.length > 0
        ) {
            enableInfluxdb = true;
        }

        if (enableInfluxdb) {
            try {
                const names = await influx.getDatabaseNames();
                if (!names.includes(dbName)) {
                    try {
                        const res = await influx.createDatabase(dbName);
                        logger.info(`CONFIG: Created new InfluxDB v1 database: ${dbName}`);

                        const newPolicy = config.get(
                            'Butler-SOS.influxdbConfig.v1Config.retentionPolicy'
                        );

                        // Create new default retention policy
                        try {
                            const res2 = await influx.createRetentionPolicy(newPolicy.name, {
                                database: dbName,
                                duration: newPolicy.duration,
                                replication: 1,
                                isDefault: true,
                            });

                            logger.info(
                                `CONFIG: Created new InfluxDB v1 retention policy: ${newPolicy.name}`
                            );
                        } catch (err) {
                            logger.error(
                                `CONFIG: Error creating new InfluxDB v1 retention policy "${newPolicy.name}"! ${err.stack}`
                            );
                        }
                    } catch (err) {
                        logger.error(
                            `CONFIG: Error creating new InfluxDB v1 database "${dbName}"! ${err.stack}`
                        );
                    }
                } else {
                    logger.info(`CONFIG: Found InfluxDB v1 database: ${dbName}`);
                }
            } catch (err) {
                logger.error(`CONFIG: Error getting list of InfluxDB v1 databases. ${err.stack}`);
            }
        }
    } else if (config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Get config
        const org = config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
        const description = config.get('Butler-SOS.influxdbConfig.v2Config.description');
        const token = config.get('Butler-SOS.influxdbConfig.v2Config.token');
        const retentionDuration = config.get(
            'Butler-SOS.influxdbConfig.v2Config.retentionDuration'
        );

        if (
            influx &&
            config.get('Butler-SOS.influxdbConfig.enable') === true &&
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
                const orgsAPI = new OrgsAPI(influx);
                const organizations = await orgsAPI.getOrgs({ org });
                if (!organizations || !organizations.orgs || !organizations.orgs.length) {
                    logger.error(`INFLUXDB2: No organization named "${org}" found!`);
                }
                orgID = organizations.orgs[0].id;
                logger.info(`INFLUXDB2: Using organization "${org}" identified by "${orgID}"`);
            } catch (err) {
                logger.error(`INFLUXDB2: Error getting organisation: ${err}`);
            }

            try {
                // Get buckets by name
                const bucketsAPI = new BucketsAPI(influx);
                try {
                    const buckets = await bucketsAPI.getBuckets({ orgID, name: bucketName });
                    if (buckets && buckets.buckets && buckets.buckets.length > 0) {
                        const bucketID = buckets.buckets[0].id;
                        logger.info(
                            `INFLUXDB2: Bucket named "${bucketName}" already exists, bucket ID="${bucketID}"`
                        );
                    }
                } catch (e) {
                    if (e instanceof HttpError && e.statusCode === 404) {
                        // Bucket not found. Let's create it
                        logger.info(
                            `INFLUXDB2: Bucket named "${bucketName}" not found, creating it...`
                        );

                        // creates a bucket, entity properties are specified in the "body" property
                        const newBucket = await bucketsAPI.postBuckets({
                            body: { orgID, name: bucketName, description, rp: retentionDuration },
                        });

                        logger.verbose(
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
                logger.error(`INFLUXDB2: Error getting bucket: ${err}`);
            }

            // Get write API

            // Create array of per-server writeAPI objects
            // Each object has two properties: host and writeAPI, where host can be used as key later on
            serverList.forEach((server) => {
                // Get per-server tags
                const tags = getServerTags(logger, server);

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
                    const serverWriteApi = influx.getWriteApi(org, bucketName, 'ns', writeOptions);

                    // Save to global variable, using hostNamre as key
                    influxWriteApi.push({
                        serverName: server.serverName,
                        writeAPI: serverWriteApi,
                    });
                } catch (err) {
                    logger.error(`INFLUXDB2: Error getting write API: ${err}`);
                }
            });
        }
    }
}

// ------------------------------------
// Create MQTT client object and connect to MQTT broker
// Only do this if MQTT is enabled
// ------------------------------------
let mqttClient;

if (config.get('Butler-SOS.mqttConfig.enable') === true) {
    mqttClient = mqtt.connect({
        port: config.get('Butler-SOS.mqttConfig.brokerPort'),
        host: config.get('Butler-SOS.mqttConfig.brokerHost'),
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
let hostInfo;

async function initHostInfo() {
    try {
        const siCPU = await si.cpu();
        const siSystem = await si.system();
        const siMem = await si.mem();
        const siOS = await si.osInfo();
        const siDocker = await si.dockerInfo();
        const siNetwork = await si.networkInterfaces();
        const siNetworkDefault = await si.networkInterfaceDefault();

        const defaultNetworkInterface = siNetworkDefault;

        const networkInterface = siNetwork.filter((item) => item.iface === defaultNetworkInterface);

        const idSrc =
            networkInterface[0].mac +
            networkInterface[0].ip4 +
            config.get('Butler-SOS.logdb.host') +
            siSystem.uuid;
        const salt = networkInterface[0].mac;
        const hash = crypto.createHmac('sha256', salt);
        hash.update(idSrc);

        // Get first 50 characters of hash
        const id = hash.digest('hex');

        hostInfo = {
            id,
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
        logger.error(`CONFIG: Getting host info: ${err}`);
        return null;
    }
}

module.exports = {
    config,
    mqttClient,
    logger,
    getLoggingLevel,
    influx,
    influxWriteApi,
    pgPool,
    appVersion,
    serverList,
    initInfluxDB,
    appNames,
    udpServerUserActivity,
    udpServerLogEvents,
    initHostInfo,
    hostInfo,
    isPkg,
    checkFileExistsSync,
    configFile,
    options,
};
