var mqtt = require('mqtt');
var config = require('config');
var winston = require('winston');

// Set up logger with timestamps and colors
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({'timestamp':true, 'colorize':true})
    ]
});


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
  logger
};
