var later = require('later');
var luxon = require ('luxon');

const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');


const fullUnits = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
luxon.Duration.prototype.toFull = function() {return this.shiftTo.apply(this, fullUnits);};
 
function serviceUptimeStart() {
    var uptimeLogLevel = globals.config.get('Butler-SOS.uptimeMonitor.logLevel'),
        uptimeInterval = globals.config.get('Butler-SOS.uptimeMonitor.frequency');

    // Formatter for numbers
    const formatter = new Intl.NumberFormat('en-US');

    // Log uptime to console
    Number.prototype.toTime = function (isSec) {
        var ms = isSec ? this * 1e3 : this,
            lm = ~(4 * !!isSec),
            /* limit fraction */
            fmt = new Date(ms).toISOString().slice(11, lm);

        if (ms >= 8.64e7) {
            /* >= 24 hours */
            var parts = fmt.split(/:(?=\d{2}:)/);
            parts[0] -= -24 * ((ms / 8.64e7) | 0);
            return parts.join(':');
        }

        return fmt;
    };

    var startTime = Date.now();
    var startIterations = 0;

    later.setInterval(function () {
        startIterations++;
        let uptimeMilliSec = Date.now() - startTime;
 
        let d = luxon.Duration.fromMillis(uptimeMilliSec).toFull().toObject();
        let dur = `${d.months} months, ${d.days} days, ${d.hours} hours, ${d.minutes} minutes, ${d.seconds} seconds`;

        let heapTotal = Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            heapUsed = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            processMemory = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;

        globals.logger.log(uptimeLogLevel, '--------------------------------');
        globals.logger.log(
            uptimeLogLevel,
            'Iteration # ' +
                formatter.format(startIterations) +
                ', Uptime: ' +
                dur + 
                `, Heap used ${heapUsed} MB of total heap ${heapTotal} MB. Memory allocated to process: ${processMemory} MB.`,
        );

        // Store to Influxdb
        let butlerSosMemoryInfluxTag = globals.config.has('Butler-SOS.uptimeMonitor.storeInInfluxdb.instanceTag') ? globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.instanceTag') : '';

        var enableInfluxDB = false;

        if ((globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') && globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') == true) || 
            (globals.config.has('Butler-SOS.influxdbConfig.enable') && globals.config.get('Butler-SOS.influxdbConfig.enable') == true)) {
            enableInfluxDB = true;
        }

        if ((globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage') == true) && (enableInfluxDB == true)) {
            postToInfluxdb.postButlerSOSMemoryUsageToInfluxdb({
                instanceTag: butlerSosMemoryInfluxTag,
                heapUsed: heapUsed,
                heapTotal: heapTotal,
                processMemory: processMemory,
            });
        }
    }, later.parse.text(uptimeInterval));
}

module.exports = {
    serviceUptimeStart,
};
