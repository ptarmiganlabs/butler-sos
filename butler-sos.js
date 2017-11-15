// Add dependencies
var request = require('request');


// Load code from sub modules
var globals = require('./globals');


// Set specific log level (if/when needed)
// Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
// globals.logger.transports.console.level = 'info';
// globals.logger.transports.console.level = 'verbose';
// globals.logger.transports.console.level = 'debug';
// Default is to use log level defined in config file
globals.logger.transports.console.level = globals.config.get('Butler-SOS.logLevel');

globals.logger.info('Starting Butler SOS');
globals.logger.info('Log level is: ' + globals.logger.transports.console.level);




function postToInfluxdb(host, serverName, body) {

    // Calculate server uptime

    var dateTime = Date.now();
    var timestamp = Math.floor(dateTime);

    var str = body.started;
    var year = str.substring(0, 4);
    var month = str.substring(4, 6);
    var day = str.substring(6, 8);
    var hour = str.substring(9, 11);
    var minute = str.substring(11, 13);
    var second = str.substring(13, 15);
    var dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);
    var timestampStarted = Math.floor(dateTimeStarted);

    var diff = timestamp - timestampStarted;


    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    var date = new Date(diff);

    var days = Math.trunc((diff) / (1000 * 60 * 60 * 24))

    // Hours part from the timestamp
    var hours = date.getHours();

    // Minutes part from the timestamp
    var minutes = "0" + date.getMinutes();

    // Seconds part from the timestamp
    var seconds = "0" + date.getSeconds();

    // Will display time in 10:30:23 format
    var formattedTime = days + ' days, ' + hours + 'h ' + minutes.substr(-2) + 'm ' + seconds.substr(-2) + 's';


    // Write the whole reading to Influxdb
    globals.influx.writePoints([{
                measurement: 'sense_server',
                tags: {
                    host: serverName
                },
                fields: {
                    version: body.version,
                    started: body.started,
                    uptime: formattedTime
                }
            },
            {
                measurement: 'mem',
                tags: {
                    host: serverName
                },
                fields: {
                    comitted: body.mem.comitted,
                    allocated: body.mem.allocated,
                    free: body.mem.free
                }
            },
            {
                measurement: 'apps',
                tags: {
                    host: serverName
                },
                fields: {
                    active_docs_count: body.apps.active_docs.length,
                    loaded_docs_count: body.apps.loaded_docs.length,
                    calls: body.apps.calls,
                    selections: body.apps.selections
                }
            },
            {
                measurement: 'cpu',
                tags: {
                    host: serverName
                },
                fields: {
                    total: body.cpu.total
                }
            },
            {
                measurement: 'session',
                tags: {
                    host: serverName
                },
                fields: {
                    active: body.session.active,
                    total: body.session.total
                }
            },
            {
                measurement: 'users',
                tags: {
                    host: serverName
                },
                fields: {
                    active: body.users.active,
                    total: body.users.total
                }
            },
            {
                measurement: 'cache',
                tags: {
                    host: serverName
                },
                fields: {
                    hits: body.cache.hits,
                    lookups: body.cache.lookups,
                    added: body.cache.added,
                    replaced: body.cache.replaced,
                    bytes_added: body.cache.bytes_added
                }
            }

        ])
        .then(err => {
            globals.logger.verbose('Sent data to Influxdb: ' + serverName);
        })

        .catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        })

}


function postToMQTT(host, serverName, body) {

    // Get base MQTT topic
    var baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(baseTopic + serverName + '/version', body.version);
    globals.mqttClient.publish(baseTopic + serverName + '/started', body.started);
    globals.mqttClient.publish(baseTopic + serverName + '/mem/comitted', body.mem.comitted.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/mem/allocated', body.mem.allocated.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/mem/free', body.mem.free.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cpu/total', body.cpu.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/session/active', body.session.active.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/session/total', body.session.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/active_docs', body.apps.active_docs.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/loaded_docs', body.apps.loaded_docs.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/calls', body.apps.calls.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/selections', body.apps.selections.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/users/active', body.users.active.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/users/total', body.users.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/hits', body.cache.hits.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/lookups', body.cache.lookups.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/added', body.cache.added.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/replaced', body.cache.replaced.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/bytes_added', body.cache.bytes_added.toString());

    if (body.cache.lookups > 0) {
        globals.mqttClient.publish(baseTopic + serverName + '/cache/hit_ratio', Math.floor(body.cache.hits / body.cache.lookups * 100).toString());
    }
}




function getStatsFromSense(server) {
    request({
        followAllRedirects: true,
        url: 'https://' + server.host + '/engine/healthcheck/',
        headers: Object.assign(server.headers, {
            'Cache-Control': 'no-cache'
        }),
        json: true
    }, function (error, response, body) {

        // Check for error
        if (error) {
            return globals.logger.error('Error:', error);
        }

        if (!error && response.statusCode === 200) {
            globals.logger.verbose('Received ok response from ' + server.serverName);
            globals.logger.debug(body);

            // Post to MQTT (if enabled)
            if ( globals.config.get('Butler-SOS.mqttConfig.enableMQTT') ) {
                globals.logger.debug('Calling MQTT posting method');
                postToMQTT(server.host, server.serverName, body);
            }

            // Post to Influxdb (if enabled)
            if ( globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') ) {
                globals.logger.debug('Calling Influxdb posting method');
                postToInfluxdb(server.host, server.serverName, body);
            }
        }
    })
}



setInterval(function () {
    globals.logger.verbose('Event started: Statistics collection');

    var serverList = globals.config.get('Butler-SOS.serversToMonitor.servers');
    serverList.forEach(function (server) {
        globals.logger.verbose('Getting stats for server: ' + server.serverName);


        getStatsFromSense(server);
    });

}, globals.config.get('Butler-SOS.pollingInterval'));
