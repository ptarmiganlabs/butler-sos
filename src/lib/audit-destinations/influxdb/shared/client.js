import Influx from 'influx';
import { InfluxDB as InfluxDB2 } from '@influxdata/influxdb-client';
import {
    InfluxDBClient as InfluxDBClient3,
    setLogger as setInfluxV3Logger,
} from '@influxdata/influxdb3-client';

import globals from '../../../../globals.js';

let cachedClient = null;
let cachedVersion = null;
let cachedKey = null;

/**
 * No-op function used to silence loggers.
 *
 * @returns {void} Nothing.
 */
function noop() {}

/**
 * Create a stable cache key for the audit Influx destination config.
 *
 * @param {object} cfg Influx destination config.
 * @returns {string} Deterministic cache key.
 */
function getConfigKey(cfg) {
    return JSON.stringify({
        host: cfg.host,
        port: cfg.port,
        version: cfg.version,
        v1: cfg.v1Config,
        v2: cfg.v2Config,
        v3: cfg.v3Config,
    });
}

/**
 * Read the audit-specific Influx destination config.
 *
 * @returns {object} Raw config subtree.
 */
function getAuditInfluxConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.influxdb');
}

/**
 * Returns an initialized audit Influx client.
 * Re-initializes if the underlying config changes.
 *
 * @returns {{ version: number, client: unknown, database?: string, org?: string, bucket?: string }} Initialized client info.
 */
export function getAuditInfluxClient() {
    const cfg = getAuditInfluxConfig();
    const key = getConfigKey(cfg);

    if (cachedClient && cachedKey === key && cachedVersion === cfg.version) {
        return cachedClient;
    }

    cachedKey = key;
    cachedVersion = cfg.version;

    if (cfg.version === 1) {
        const client = new Influx.InfluxDB({
            host: cfg.host,
            port: cfg.port,
            database: cfg.v1Config.dbName,
            username: cfg.v1Config.auth.enable ? cfg.v1Config.auth.username : '',
            password: cfg.v1Config.auth.enable ? cfg.v1Config.auth.password : '',
        });

        cachedClient = {
            version: 1,
            client,
        };
        return cachedClient;
    }

    if (cfg.version === 2) {
        const url = `http://${cfg.host}:${cfg.port}`;
        const client = new InfluxDB2({ url, token: cfg.v2Config.token });

        cachedClient = {
            version: 2,
            client,
            org: cfg.v2Config.org,
            bucket: cfg.v2Config.bucket,
        };
        return cachedClient;
    }

    if (cfg.version === 3) {
        setInfluxV3Logger({
            error: noop,
            warn: noop,
        });

        const host = `http://${cfg.host}:${cfg.port}`;
        const client = new InfluxDBClient3({
            host,
            token: cfg.v3Config.token,
            database: cfg.v3Config.database,
            timeout: cfg.v3Config.writeTimeout ?? 10000,
        });

        cachedClient = {
            version: 3,
            client,
            database: cfg.v3Config.database,
        };
        return cachedClient;
    }

    globals.logger.warn(`AUDIT INFLUX CLIENT: Unsupported InfluxDB version v${cfg.version}`);
    cachedClient = { version: cfg.version, client: null };
    return cachedClient;
}
