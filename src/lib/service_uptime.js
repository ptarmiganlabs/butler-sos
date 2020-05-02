var later = require('later');
var moment = require('moment');
require('moment-precise-range-plugin');


function serviceUptimeStart() {
    var uptimeLogLevel = 'verbose',
        uptimeInterval = 'every 600 seconds';

    // Formatter for numbers
    const formatter = new Intl.NumberFormat('en-US');

    // Log uptime to console
    Number.prototype.toTime = function(isSec) {
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

    var uptimeCheck = later.setInterval(function() {
        startIterations++;
        let uptimeMilliSec = Date.now() - startTime;
        moment.duration(uptimeMilliSec);

        logger.log(uptimeLogLevel, '--------------------------------');
        logger.log(
            uptimeLogLevel,
            'Iteration # ' +
                formatter.format(startIterations) +
                ', Uptime: ' +
                moment.preciseDiff(0, uptimeMilliSec) +

                // formatter.format(uptimeMilliSec / 1000) +
                // ' seconds' +
                ', Heap used: ' +
                formatter.format(process.memoryUsage().heapUsed),
        );
    }, later.parse.text(uptimeInterval));
}

module.exports = {
    serviceUptimeStart,
};
