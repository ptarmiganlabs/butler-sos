var mqtt = require("mqtt");
var config = require("config");
var winston = require("winston");
const Influx = require("influx");
const {
  Pool
} = require("pg");


// Get app version from package.json file
var appVersion = require('./package.json').version;


// Set up logger with timestamps and colors
const logTransports = {
  console: new winston.transports.Console({
    name: 'console_log',
    level: config.get('Butler-SOS.logLevel'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
  })
};


const logger = winston.createLogger({
  transports: [
    logTransports.console
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  )
});


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
  logger.log("error", "Unexpected error on idle client" + err);
  process.exit(-1);
});

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
      tags: ["host", "server_type"]
    },
    {
      measurement: "mem",
      fields: {
        comitted: Influx.FieldType.INTEGER,
        allocated: Influx.FieldType.INTEGER,
        free: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
    },
    {
      measurement: "apps",
      fields: {
        active_docs_count: Influx.FieldType.INTEGER,
        loaded_docs_count: Influx.FieldType.INTEGER,
        in_memory_docs_count: Influx.FieldType.INTEGER,
        calls: Influx.FieldType.INTEGER,
        selections: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
    },
    {
      measurement: "cpu",
      fields: {
        total: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
    },
    {
      measurement: "session",
      fields: {
        active: Influx.FieldType.INTEGER,
        total: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
    },
    {
      measurement: "users",
      fields: {
        active: Influx.FieldType.INTEGER,
        total: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
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
      tags: ["host", "server_type"]
    },
    {
      measurement: "log_event",
      fields: {
        hits: Influx.FieldType.INTEGER,
        lookups: Influx.FieldType.INTEGER,
        added: Influx.FieldType.INTEGER,
        replaced: Influx.FieldType.INTEGER,
        bytes_added: Influx.FieldType.INTEGER
      },
      tags: ["host", "server_type"]
    }
  ]
});


if (config.get("Butler-SOS.influxdbConfig.enableInfluxdb")) {
  influx
    .getDatabaseNames()
    .then(names => {
      if (!names.includes(config.get("Butler-SOS.influxdbConfig.dbName"))) {
        logger.info("Creating Influx database.");
        return influx.createDatabase(
          config.get("Butler-SOS.influxdbConfig.dbName")
        );
      }
    })
    .then(() => {
      logger.info("Connected to Influx database.");
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
  logTransports,
  influx,
  pgPool,
  appVersion
};