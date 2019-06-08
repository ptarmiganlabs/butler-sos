var mqtt = require("mqtt");
var config = require("config");

const winston = require('winston');
require('winston-daily-rotate-file');
var config = require('config');
const path = require('path');

const Influx = require("influx");
const {
  Pool
} = require("pg");


// Get app version from package.json file
var appVersion = require('./package.json').version;


// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

logTransports.push(
  new winston.transports.Console({
      name: 'console',
      level: config.get('Butler-SOS.logLevel'),
      format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
  })
);


if (config.get('Butler-SOS.fileLogging')) {
  logTransports.push(
      new(winston.transports.DailyRotateFile)({
          dirname: path.join(__dirname, config.get('Butler-SOS.logDirectory')),
          filename: 'butler-sos.%DATE%.log',
          level: config.get('Butler-SOS.logLevel'),
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d'
      })
  );
}


logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
});


// Function to get current logging level
getLoggingLevel = () => {
  return logTransports.find(transport => {
      return transport.name=='console';
  }).level;
}

// Get info on what servers to monitor
const serverList = config.get("Butler-SOS.serversToMonitor.servers");


// Get info on what virtual proxies to get session data for
const userSessionsServers = config.get("Butler-SOS.userSessions.servers");


// Set up connection pool for accessing Qlik Sense log db
const pgPool = new Pool({
  host: config.get("Butler-SOS.logdb.host"),
  database: "QLogs",
  user: config.get("Butler-SOS.logdb.qlogsReaderUser"),
  password: config.get("Butler-SOS.logdb.qlogsReaderPwd"),
  port: config.get("Butler-SOS.logdb.port")
});

// the pool with emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pgPool.on("error", (err, client) => {
  logger.error(`Unexpected error on idle client: ${err}`);
  process.exit(-1);
});




// Get list of standard and user configurable tags 
// ..begin with standard tags
let tagValues = [
  "host",
  "server_name",
  "server_description"
];

// ..check if there are any extra tags for this server that should be sent to InfluxDB 
if (config.has('Butler-SOS.serversToMonitor.serverTagsDefinition')) {

  // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
  config.get('Butler-SOS.serversToMonitor.serverTagsDefinition').forEach(entry => {
    logger.debug(`Setting up new Influx database: Found server tag : ${entry}`);

    tagValues.push(entry);
  });

}

// Events need a couple of extra tags
let tagValuesLogEvent = tagValues.slice();
tagValuesLogEvent.push("source_process");
tagValuesLogEvent.push("log_level");

// Set up Influxdb client
const influx = new Influx.InfluxDB({
  host: config.get("Butler-SOS.influxdbConfig.hostIP"),
  database: config.get("Butler-SOS.influxdbConfig.dbName"),
  schema: [{
      measurement: "sense_server",
      fields: {
        version: Influx.FieldType.STRING,
        started: Influx.FieldType.STRING,
        uptime: Influx.FieldType.STRING
      },
      tags: tagValues
    },
    {
      measurement: "mem",
      fields: {
        comitted: Influx.FieldType.INTEGER,
        allocated: Influx.FieldType.INTEGER,
        free: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "apps",
      fields: {
        active_docs_count: Influx.FieldType.INTEGER,
        loaded_docs_count: Influx.FieldType.INTEGER,
        in_memory_docs_count: Influx.FieldType.INTEGER,
        active_docs: Influx.FieldType.STRING,
        loaded_docs: Influx.FieldType.STRING,
        in_memory_docs: Influx.FieldType.STRING,
        calls: Influx.FieldType.INTEGER,
        selections: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "cpu",
      fields: {
        total: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "session",
      fields: {
        active: Influx.FieldType.INTEGER,
        total: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "users",
      fields: {
        active: Influx.FieldType.INTEGER,
        total: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "cache",
      fields: {
        hits: Influx.FieldType.INTEGER,
        lookups: Influx.FieldType.INTEGER,
        added: Influx.FieldType.INTEGER,
        replaced: Influx.FieldType.INTEGER,
        bytes_added: Influx.FieldType.INTEGER
      },
      tags: tagValues
    },
    {
      measurement: "log_event",
      fields: {
        message: Influx.FieldType.STRING
      },
      tags: tagValuesLogEvent
    }
  ]
});


if (config.get("Butler-SOS.influxdbConfig.enableInfluxdb")) {
  influx
    .getDatabaseNames()
    .then(names => {
      if (!names.includes(config.get("Butler-SOS.influxdbConfig.dbName"))) {
        logger.info(`Creating Influx database.`);
        return influx.createDatabase(
          config.get("Butler-SOS.influxdbConfig.dbName")
        );
      }
    })
    .then(() => {
      logger.info(`Connected to Influx database.`);
      return;
    })
    .catch(err => {
      logger.error(`Error creating Influx database!`);
    });
}

// ------------------------------------
// Create MQTT client object and connect to MQTT broker
var mqttClient = mqtt.connect({
  port: config.get("Butler-SOS.mqttConfig.brokerPort"),
  host: config.get("Butler-SOS.mqttConfig.brokerHost")
});

/*
Following might be needed for conecting to older Mosquitto versions
var mqttClient  = mqtt.connect('mqtt://<IP of MQTT server>', {
  protocolId: 'MQIsdp',
  protocolVersion: 3
});
*/

module.exports = {
  config,
  mqttClient,
  logger,
  getLoggingLevel,
  influx,
  pgPool,
  appVersion,
  serverList,
  userSessionsServers
};