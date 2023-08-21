/* eslint-disable no-bitwise */
const later = require('@breejs/later');
const luxon = require('luxon');

const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToNewRelic = require('./post-to-new-relic');

const fullUnits = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
luxon.Duration.prototype.toFull = function convToFull() {
    // return this.shiftTo.apply(this, fullUnits);
    return this.shiftTo(...fullUnits); // Suggested bt GitHub Copilot
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

    const sched = later.parse.text(uptimeInterval);
    const nextOccurence = later.schedule(sched).next(4);
    const intervalMillisec = nextOccurence[3].getTime() - nextOccurence[2].getTime();
    globals.logger.debug(
        `UPTIME: Interval between uptime events: ${intervalMillisec} milliseconds`
    );

    later.setInterval(() => {
        startIterations += 1;
        const uptimeMilliSec = Date.now() - startTime;

        const d = luxon.Duration.fromMillis(uptimeMilliSec).toFull().toObject();
        const uptimeString = `${d.months} months, ${d.days} days, ${d.hours} hours, ${d.minutes} minutes, ${d.seconds} seconds`;

        const { heapTotal } = process.memoryUsage();
        const { heapUsed } = process.memoryUsage();
        const processMemory = process.memoryUsage().rss;
        const externalMemory = process.memoryUsage().external;

        const heapTotalMByte = Math.round((heapTotal / 1024 / 1024) * 100) / 100;
        const heapUsedMByte = Math.round((heapUsed / 1024 / 1024) * 100) / 100;
        const processMemoryMByte = Math.round((processMemory / 1024 / 1024) * 100) / 100;
        const externalMemoryMByte = Math.round((externalMemory / 1024 / 1024) * 100) / 100;

        globals.logger.log(uptimeLogLevel, '--------------------------------');
        globals.logger.log(
            uptimeLogLevel,
            `Iteration # ${formatter.format(
                startIterations
            )}, Uptime: ${uptimeString}, Heap used ${heapUsedMByte} MB of total heap ${heapTotalMByte} MB. External (off-heap): ${externalMemoryMByte} MB. Memory allocated to process: ${processMemoryMByte} MB.`
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
                heapUsedMByte,
                heapTotalMByte,
                externalMemoryMByte,
                processMemoryMByte,
            });
        }

        // Send to New Relic
        if (
            globals.config.has('Butler-SOS.uptimeMonitor.storeNewRelic.enable') &&
            globals.config.get('Butler-SOS.uptimeMonitor.storeNewRelic.enable') === true
        ) {
            postToNewRelic.postButlerSOSUptimeToNewRelic({
                intervalMillisec,
                heapUsed,
                heapTotal,
                externalMemory,
                processMemory,
                startIterations,
                uptimeMilliSec,
                uptimeString,
            });
        }
    }, later.parse.text(uptimeInterval));
}

module.exports = {
    serviceUptimeStart,
};
