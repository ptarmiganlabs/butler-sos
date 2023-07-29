const mqtt = require('mqtt');
const fs = require('fs-extra');
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const dgram = require('dgram');
const si = require('systeminformation');
const os = require('os');
const crypto = require('crypto');

const { Command, Option } = require('commander');

const Influx = require('influx');
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
    .option('--new-relic-account-id <id...>', 'New Relic account ID');

// Parse command line params
program.parse(process.argv);
const options = program.opts();

// Is there a config file specified on the command line?
let configFileOption;
let configFileExpanded;
let configFilePath;
let configFileBasename;
let configFileExtension;
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
}

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

    //
    for (let index = 0; index < options.newRelicApiKey.length; index++) {
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
    udpServerUserActivity.host = config.has('Butler-SOS.userEvents.udpServerConfig.serverHost')
        ? config.get('Butler-SOS.userEvents.udpServerConfig.serverHost')
        : '';

    // Prepare to listen on port X for incoming UDP connections regarding user activity events
    udpServerUserActivity.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
    });

    udpServerUserActivity.portUserActivity = config.has(
        'Butler-SOS.userEvents.udpServerConfig.portUserActivityEvents'
    )
        ? config.get('Butler-SOS.userEvents.udpServerConfig.portUserActivityEvents')
        : '';
} catch (err) {
    logger.error(`CONFIG: Setting up UDP user activity listener: ${err}`);
}

// ------------------------------------
// Log events UDP server
const udpServerLogEvents = {};

try {
    udpServerLogEvents.host = config.has('Butler-SOS.logEvents.udpServerConfig.serverHost')
        ? config.get('Butler-SOS.logEvents.udpServerConfig.serverHost')
        : '';

    // Prepare to listen on port X for incoming UDP connections regarding user activity events
    udpServerLogEvents.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
    });

    udpServerLogEvents.port = config.has('Butler-SOS.logEvents.udpServerConfig.portLogEvents')
        ? config.get('Butler-SOS.logEvents.udpServerConfig.portLogEvents')
        : '';
} catch (err) {
    logger.error(`CONFIG: Setting up UDP log events listener: ${err}`);
}

// ------------------------------------
// Get info on what servers to monitor
const serverList = config.get('Butler-SOS.serversToMonitor.servers');

// Set up connection pool for accessing Qlik Sense log db
const pgPool = new Pool({
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
            `CONFIG: Setting up new Influx database: Found log event tag in config file: ${entry}`
        );

        tagValuesLogEvent.push(entry.tag);
    });
}

// Create InfluxDB tags for data coming from log db
const tagValuesLogEventLogDb = tagValues.slice();
tagValuesLogEventLogDb.push('source_process');
tagValuesLogEventLogDb.push('log_level');

if (
    (config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
        config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
    (config.has('Butler-SOS.influxdbConfig.enable') &&
        config.get('Butler-SOS.influxdbConfig.enable') === true)
) {
    logger.info(`CONFIG: Influxdb enabled: true`);
    logger.info(`CONFIG: Influxdb host IP: ${config.get('Butler-SOS.influxdbConfig.hostIP')}`);
    logger.info(`CONFIG: Influxdb host port: ${config.get('Butler-SOS.influxdbConfig.hostPort')}`);
    logger.info(`CONFIG: Influxdb db name: ${config.get('Butler-SOS.influxdbConfig.dbName')}`);
} else {
    logger.info(`CONFIG: Influxdb enabled: false`);
}

// Set up Influxdb client
const influx = new Influx.InfluxDB({
    host: config.get('Butler-SOS.influxdbConfig.hostIP'),
    port: `${
        config.has('Butler-SOS.influxdbConfig.hostPort')
            ? config.get('Butler-SOS.influxdbConfig.hostPort')
            : '8086'
    }`,
    database: config.get('Butler-SOS.influxdbConfig.dbName'),
    username: `${
        config.get('Butler-SOS.influxdbConfig.auth.enable')
            ? config.get('Butler-SOS.influxdbConfig.auth.username')
            : ''
    }`,
    password: `${
        config.get('Butler-SOS.influxdbConfig.auth.enable')
            ? config.get('Butler-SOS.influxdbConfig.auth.password')
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
            tags: ['butler_sos_instance'],
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

function initInfluxDB() {
    const dbName = config.get('Butler-SOS.influxdbConfig.dbName');
    let enableInfluxdb = false;

    if (
        (config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
            config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
        (config.has('Butler-SOS.influxdbConfig.enable') &&
            config.get('Butler-SOS.influxdbConfig.enable') === true)
    ) {
        enableInfluxdb = true;
    }

    if (enableInfluxdb) {
        influx
            .getDatabaseNames()
            .then((names) => {
                if (!names.includes(dbName)) {
                    influx
                        .createDatabase(dbName)
                        .then(() => {
                            logger.info(`CONFIG: Created new InfluxDB database: ${dbName}`);

                            const newPolicy = config.get(
                                'Butler-SOS.influxdbConfig.retentionPolicy'
                            );

                            // Create new default retention policy
                            influx
                                .createRetentionPolicy(newPolicy.name, {
                                    database: dbName,
                                    duration: newPolicy.duration,
                                    replication: 1,
                                    isDefault: true,
                                })
                                .then(() => {
                                    logger.info(
                                        `CONFIG: Created new InfluxDB retention policy: ${newPolicy.name}`
                                    );
                                })
                                .catch((err) => {
                                    logger.error(
                                        `CONFIG: Error creating new InfluxDB retention policy "${newPolicy.name}"! ${err.stack}`
                                    );
                                });
                        })
                        .catch((err) => {
                            logger.error(
                                `CONFIG: Error creating new InfluxDB database "${dbName}"! ${err.stack}`
                            );
                        });
                } else {
                    logger.info(`CONFIG: Found InfluxDB database: ${dbName}`);
                }
            })
            .catch((err) => {
                logger.error(`CONFIG: Error getting list of InfluxDB databases! ${err.stack}`);
            });
    }
}

// ------------------------------------
// Create MQTT client object and connect to MQTT broker
const mqttClient = mqtt.connect({
    port: config.get('Butler-SOS.mqttConfig.brokerPort'),
    host: config.get('Butler-SOS.mqttConfig.brokerHost'),
});

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
};
