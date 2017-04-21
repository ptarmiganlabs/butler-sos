var mqtt = require('mqtt');
var config = require('config');
var winston = require('winston');
const Influx = require('influx');



// Set up logger with timestamps and colors
var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            'timestamp': true,
            'colorize': true
        })
    ]
});


// Set up Influxdb client
const influx = new Influx.InfluxDB({
    host: config.get('Butler-SOS.influxdbConfig.hostIP'),
    database: config.get('Butler-SOS.influxdbConfig.dbName'),
    schema: [
        {
            measurement: 'sense_server',
            fields: {
                version: Influx.FieldType.STRING,
                started: Influx.FieldType.STRING,
                uptime: Influx.FieldType.STRING
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'mem',
            fields: {
                comitted: Influx.FieldType.INTEGER,
                allocated: Influx.FieldType.INTEGER,
                free: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'apps',
            fields: {
                active_docs_count: Influx.FieldType.INTEGER,
                loaded_docs_count: Influx.FieldType.INTEGER,
                calls: Influx.FieldType.INTEGER,
                selections: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'cpu',
            fields: {
                total: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'session',
            fields: {
                active: Influx.FieldType.INTEGER,
                total: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'users',
            fields: {
                active: Influx.FieldType.INTEGER,
                total: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        },
        {
            measurement: 'cache',
            fields: {
                hits: Influx.FieldType.INTEGER,
                lookups: Influx.FieldType.INTEGER,
                added: Influx.FieldType.INTEGER,
                replaced: Influx.FieldType.INTEGER,
                bytes_added: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        }
    ]
})


influx.getDatabaseNames()
    .then(names => {
        if (!names.includes(config.get('Butler-SOS.influxdbConfig.dbName'))) {
            logger.info('Creating Influx database.');
            return influx.createDatabase(config.get('Butler-SOS.influxdbConfig.dbName'));
        }
    })
    .then(() => {
        logger.info('Connected to Influx database.');
        return;
    })
    .catch(err => {
        logger.error(`Error creating Influx database!`);
    })



// ------------------------------------
// Create MQTT client object and connect to MQTT broker
var mqttClient = mqtt.connect('mqtt://' + config.get('Butler-SOS.mqttConfig.brokerIP'));
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
    influx
};