import globals from '../../globals.js';
import { getInfluxDbVersion, useRefactoredInfluxDb } from './shared/utils.js';

// Import version-specific implementations
import { storeHealthMetricsV1 } from './v1/health-metrics.js';
import { storeSessionsV1 } from './v1/sessions.js';
import { storeButlerMemoryV1 } from './v1/butler-memory.js';
import { storeUserEventV1 } from './v1/user-events.js';
import { storeEventCountV1, storeRejectedEventCountV1 } from './v1/event-counts.js';
import { storeUserEventQueueMetricsV1, storeLogEventQueueMetricsV1 } from './v1/queue-metrics.js';
import { storeLogEventV1 } from './v1/log-events.js';

import { storeHealthMetricsV2 } from './v2/health-metrics.js';
import { storeSessionsV2 } from './v2/sessions.js';
import { storeButlerMemoryV2 } from './v2/butler-memory.js';
import { storeUserEventV2 } from './v2/user-events.js';
import { storeEventCountV2, storeRejectedEventCountV2 } from './v2/event-counts.js';
import { storeUserEventQueueMetricsV2, storeLogEventQueueMetricsV2 } from './v2/queue-metrics.js';
import { storeLogEventV2 } from './v2/log-events.js';

import { postHealthMetricsToInfluxdbV3 } from './v3/health-metrics.js';
import { postProxySessionsToInfluxdbV3 } from './v3/sessions.js';
import { postButlerSOSMemoryUsageToInfluxdbV3 } from './v3/butler-memory.js';
import { postUserEventToInfluxdbV3 } from './v3/user-events.js';
import { storeEventCountInfluxDBV3, storeRejectedEventCountInfluxDBV3 } from './v3/event-counts.js';
import {
    postUserEventQueueMetricsToInfluxdbV3,
    postLogEventQueueMetricsToInfluxdbV3,
} from './v3/queue-metrics.js';
import { postLogEventToInfluxdbV3 } from './v3/log-events.js';

/**
 * Factory function that routes health metrics to the appropriate InfluxDB version implementation.
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} serverTags - Tags to associate with the metrics
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postHealthMetricsToInfluxdb(serverName, host, body, serverTags) {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeHealthMetricsV1(serverTags, body);
    }
    if (version === 2) {
        return storeHealthMetricsV2(serverName, host, body);
    }
    if (version === 3) {
        return postHealthMetricsToInfluxdbV3(serverName, host, body, serverTags);
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes proxy sessions to the appropriate InfluxDB version implementation.
 *
 * @param {object} userSessions - User session data
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postProxySessionsToInfluxdb(userSessions) {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeSessionsV1(userSessions);
    }
    if (version === 2) {
        return storeSessionsV2(userSessions);
    }
    if (version === 3) {
        return postProxySessionsToInfluxdbV3(userSessions);
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes Butler SOS memory usage to the appropriate InfluxDB version implementation.
 *
 * @param {object} memory - Memory usage data object
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postButlerSOSMemoryUsageToInfluxdb(memory) {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeButlerMemoryV1(memory);
    }
    if (version === 2) {
        return storeButlerMemoryV2(memory);
    }
    if (version === 3) {
        return postButlerSOSMemoryUsageToInfluxdbV3(memory);
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes user events to the appropriate InfluxDB version implementation.
 *
 * @param {object} msg - The user event message
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postUserEventToInfluxdb(msg) {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeUserEventV1(msg);
    }
    if (version === 2) {
        return storeUserEventV2(msg);
    }
    if (version === 3) {
        return postUserEventToInfluxdbV3(msg);
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes event count storage to the appropriate InfluxDB version implementation.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeEventCountInfluxDB() {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeEventCountV1();
    }
    if (version === 2) {
        return storeEventCountV2();
    }
    if (version === 3) {
        return storeEventCountInfluxDBV3();
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes rejected event count storage to the appropriate InfluxDB version implementation.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeRejectedEventCountInfluxDB() {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeRejectedEventCountV1();
    }
    if (version === 2) {
        return storeRejectedEventCountV2();
    }
    if (version === 3) {
        return storeRejectedEventCountInfluxDBV3();
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

/**
 * Factory function that routes user event queue metrics to the appropriate InfluxDB version implementation.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postUserEventQueueMetricsToInfluxdb() {
    try {
        const version = getInfluxDbVersion();

        if (version === 1) {
            return storeUserEventQueueMetricsV1();
        }
        if (version === 2) {
            return storeUserEventQueueMetricsV2();
        }
        if (version === 3) {
            return postUserEventQueueMetricsToInfluxdbV3();
        }

        globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
        throw new Error(`InfluxDB v${version} not supported`);
    } catch (err) {
        globals.logger.error(
            `INFLUXDB FACTORY: Error in postUserEventQueueMetricsToInfluxdb: ${err.message}`
        );
        globals.logger.debug(`INFLUXDB FACTORY: Error stack: ${err.stack}`);
        throw err;
    }
}

/**
 * Factory function that routes log event queue metrics to the appropriate InfluxDB version implementation.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postLogEventQueueMetricsToInfluxdb() {
    try {
        const version = getInfluxDbVersion();

        if (version === 1) {
            return storeLogEventQueueMetricsV1();
        }
        if (version === 2) {
            return storeLogEventQueueMetricsV2();
        }
        if (version === 3) {
            return postLogEventQueueMetricsToInfluxdbV3();
        }

        globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
        throw new Error(`InfluxDB v${version} not supported`);
    } catch (err) {
        globals.logger.error(
            `INFLUXDB FACTORY: Error in postLogEventQueueMetricsToInfluxdb: ${err.message}`
        );
        globals.logger.debug(`INFLUXDB FACTORY: Error stack: ${err.stack}`);
        throw err;
    }
}

/**
 * Factory function that routes log events to the appropriate InfluxDB version implementation.
 *
 * @param {object} msg - The log event message
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postLogEventToInfluxdb(msg) {
    const version = getInfluxDbVersion();

    if (version === 1) {
        return storeLogEventV1(msg);
    }
    if (version === 2) {
        return storeLogEventV2(msg);
    }
    if (version === 3) {
        return postLogEventToInfluxdbV3(msg);
    }

    globals.logger.debug(`INFLUXDB FACTORY: Unknown InfluxDB version: v${version}`);
    throw new Error(`InfluxDB v${version} not supported`);
}

// TODO: Add other factory functions as they're implemented
// etc...
