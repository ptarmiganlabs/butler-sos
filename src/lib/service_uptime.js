import later from '@breejs/later';
import { Duration } from 'luxon';

import globals from '../globals.js';
import { postButlerSOSMemoryUsageToInfluxdb } from './post-to-influxdb.js';
import { postButlerSOSUptimeToNewRelic } from './post-to-new-relic.js';

const fullUnits = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];

/**
 * Extends Luxon's Duration prototype to add a toFull method.
 *
 * This method shifts the duration to include all time units from years to seconds,
 * providing a complete representation of the duration.
 *
 * @returns {Duration} A new Duration object with time shifted to all units
 */
Duration.prototype.toFull = function convToFull() {
    // return this.shiftTo.apply(this, fullUnits);
    return this.shiftTo(...fullUnits); // Suggested bt GitHub Copilot
};

/**
 * Starts monitoring and reporting of Butler SOS service uptime and memory usage.
 *
 * This function sets up a timer to periodically log Butler SOS uptime and memory usage statistics.
 * It also optionally sends this data to InfluxDB and/or New Relic for long-term storage and analysis.
 * The function uses the frequency and log level settings from the Butler SOS config file.
 *
 * Data tracked includes:
 * - Uptime duration (formatted as months, days, hours, minutes, seconds)
 * - Heap memory usage (used and total)
 * - External (off-heap) memory
 * - Total process memory allocation
 *
 * @returns {void}
 */
export function serviceUptimeStart() {
    const uptimeLogLevel = globals.config.get('Butler-SOS.uptimeMonitor.logLevel');
    const uptimeInterval = globals.config.get('Butler-SOS.uptimeMonitor.frequency');

    // Formatter for numbers
    const formatter = new Intl.NumberFormat('en-US');

    // Log uptime to console
    /**
     * Extends Number prototype to add a toTime method.
     *
     * This method converts a number representing milliseconds (or seconds if isSec is true)
     * into a formatted time string. For durations less than 24 hours, it returns the time
     * in HH:MM:SS format. For longer durations, it includes the days in the hours part.
     *
     * @param {boolean} isSec - If true, treat the number as seconds instead of milliseconds
     * @returns {string} A formatted time string
     */
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

        const d = Duration.fromMillis(uptimeMilliSec).toFull().toObject();
        // Round to whole seconds
        d.seconds = Math.round(d.seconds);
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

        if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            enableInfluxDB = true;
        }

        if (
            globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage') ===
                true &&
            enableInfluxDB === true
        ) {
            postButlerSOSMemoryUsageToInfluxdb({
                instanceTag: butlerSosMemoryInfluxTag,
                heapUsedMByte,
                heapTotalMByte,
                externalMemoryMByte,
                processMemoryMByte,
            });
        }

        // Send to New Relic
        if (globals.config.get('Butler-SOS.uptimeMonitor.storeNewRelic.enable') === true) {
            postButlerSOSUptimeToNewRelic({
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
