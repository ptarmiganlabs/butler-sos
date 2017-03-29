// Add dependencies
var request = require('request');


// Load code from sub modules
var globals = require('./globals');


// Set specific log level (if/when needed)
// Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
// globals.logger.transports.console.level = 'info';
globals.logger.transports.console.level = 'verbose';
// globals.logger.transports.console.level = 'debug';

globals.logger.info('Starting Butler SOS');




function postStatsToMQTT(host, serverName) {
    request({
        followAllRedirects: true,
        url: 'https://' + host + '/healthcheck/engine/healthcheck/',
        headers: {
            'Cache-Control':'no-cache'
        },
        json: true
    }, function (error, response, body) {

        // Check for error
        if(error){
            return globals.logger.error('Error:', error);
        }

        if (!error && response.statusCode === 200) {
            globals.logger.verbose('Received ok response from ' + serverName);
            globals.logger.debug(body);

            // Get base MQT topic
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
        }
        
    })
}


setInterval(function() { 
    globals.logger.verbose('Event started: Statistics collection');

    var serverList = globals.config.get('Butler-SOS.serversToMonitor.servers');
    serverList.forEach(function(server) {
        globals.logger.verbose('Getting stats for server: ' + server.serverName);
        postStatsToMQTT(server.host, server.serverName); 
    });

}, globals.config.get('Butler-SOS.pollingInterval'));

