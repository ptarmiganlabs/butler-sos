/* eslint-disable no-bitwise */
const later = require('@breejs/later');
const luxon = require('luxon');

const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');

const fullUnits = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
luxon.Duration.prototype.toFull = function convToFull() {
    return this.shiftTo.apply(this, fullUnits);
};

function serviceUptimeStart() {
    const uptimeLogLevel = globals.config.get('Butler-SOS.uptimeMonitor.logLevel');
    const uptimeInterval = globals.config.get('Butler-SOS.uptimeMonitor.frequency');

    // Formatter for numbers
    const formatter = new Intl.NumberFormat('en-US');

    // Log uptime to console
    // eslint-disable-next-line no-extend-native
    Number.prototype.toTime = function convToTime(isSec) {
        const ms = isSec ? this * 1e3 : this;
        const lm = ~(4 * !!isSec);
        /* limit fraction */
        const fmt = new Date(ms).toISOString().slice(11, lm);

        if (ms >= 8.64e7) {
            /* >= 24 hours */
            const parts = fmt.split(/:(?=\d{2}:)/);
            parts[0] -= -24 * ((ms / 8.64e7) | 0);
            return parts.join(':');
        }

        return fmt;
    };

    const startTime = Date.now();
    let startIterations = 0;

    later.setInterval(() => {
        startIterations += 1;
        const uptimeMilliSec = Date.now() - startTime;

        const d = luxon.Duration.fromMillis(uptimeMilliSec).toFull().toObject();
        const dur = `${d.months} months, ${d.days} days, ${d.hours} hours, ${d.minutes} minutes, ${d.seconds} seconds`;

        const heapTotal = Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100;
        const heapUsed = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
        const processMemory = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;

        globals.logger.log(uptimeLogLevel, '--------------------------------');
        globals.logger.log(
            uptimeLogLevel,
            `Iteration # ${formatter.format(
                startIterations
            )}, Uptime: ${dur}, Heap used ${heapUsed} MB of total heap ${heapTotal} MB. Memory allocated to process: ${processMemory} MB.`
        );

        // Store to Influxdb
        const butlerSosMemoryInfluxTag = globals.config.has(
            'Butler-SOS.uptimeMonitor.storeInInfluxdb.instanceTag'
        )
            ? globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.instanceTag')
            : '';

        let enableInfluxDB = false;

        if (
            (globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
            (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                globals.config.get('Butler-SOS.influxdbConfig.enable') === true)
        ) {
            enableInfluxDB = true;
        }

        if (
            globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage') ===
                true &&
            enableInfluxDB === true
        ) {
            postToInfluxdb.postButlerSOSMemoryUsageToInfluxdb({
                instanceTag: butlerSosMemoryInfluxTag,
                heapUsed,
                heapTotal,
                processMemory,
            });
        }
    }, later.parse.text(uptimeInterval));
}

module.exports = {
    serviceUptimeStart,
};
