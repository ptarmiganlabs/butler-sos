import { OrgsAPI, BucketsAPI } from '@influxdata/influxdb-client-apis';
import { HttpError } from '@influxdata/influxdb-client';

import globals from '../../../globals.js';
import { getAuditInfluxClient } from './shared/client.js';

/**
 * Returns true if the audit events API is enabled.
 *
 * @returns {boolean} True if enabled.
 */
function isAuditApiEnabled() {
    return (
        globals.config.has('Butler-SOS.auditEvents.enable') &&
        globals.config.get('Butler-SOS.auditEvents.enable') === true
    );
}

/**
 * Returns true if audit events destination handling is enabled.
 *
 * @returns {boolean} True if enabled.
 */
function isAuditDestinationEnabled() {
    return (
        globals.config.has('Butler-SOS.auditEvents.destination.enable') &&
        globals.config.get('Butler-SOS.auditEvents.destination.enable') === true
    );
}

/**
 * Get audit InfluxDB destination configuration.
 *
 * @returns {object} Audit InfluxDB destination configuration.
 */
function getAuditInfluxConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.influxdb');
}

/**
 * Ensure InfluxDB v1 database exists for audit events.
 * Creates database if missing and attempts to create the configured retention policy.
 *
 * @param {object} cfg Audit InfluxDB destination configuration.
 * @returns {Promise<void>} Resolves when initialization is complete.
 */
async function ensureInfluxV1DatabaseExists(cfg) {
    const dbName = cfg?.v1Config?.dbName;

    if (!dbName || typeof dbName !== 'string') {
        globals.logger.warn('AUDIT INFLUX INIT: No v1 dbName configured; skipping init.');
        return;
    }

    const clientInfo = getAuditInfluxClient();
    if (!clientInfo?.client) {
        globals.logger.warn('AUDIT INFLUX INIT: No v1 client available; skipping init.');
        return;
    }

    try {
        const names = await clientInfo.client.getDatabaseNames();
        if (Array.isArray(names) && names.includes(dbName)) {
            globals.logger.info(`AUDIT INFLUX INIT: Found InfluxDB v1 database: ${dbName}`);
            return;
        }

        try {
            await clientInfo.client.createDatabase(dbName);
            globals.logger.info(`AUDIT INFLUX INIT: Created new InfluxDB v1 database: ${dbName}`);

            const newPolicy = cfg?.v1Config?.retentionPolicy;
            if (!newPolicy?.name || !newPolicy?.duration) {
                globals.logger.warn(
                    `AUDIT INFLUX INIT: Missing v1 retentionPolicy config for db=${dbName}; skipping policy creation.`
                );
                return;
            }

            try {
                await clientInfo.client.createRetentionPolicy(newPolicy.name, {
                    database: dbName,
                    duration: newPolicy.duration,
                    replication: 1,
                    isDefault: true,
                });

                globals.logger.info(
                    `AUDIT INFLUX INIT: Created new InfluxDB v1 retention policy: ${newPolicy.name}`
                );
            } catch (err) {
                globals.logger.error(
                    `AUDIT INFLUX INIT: Error creating InfluxDB v1 retention policy "${newPolicy.name}"! ${globals.getErrorMessage(err)}`
                );
            }
        } catch (err) {
            globals.logger.error(
                `AUDIT INFLUX INIT: Error creating InfluxDB v1 database "${dbName}"! ${globals.getErrorMessage(err)}`
            );
        }
    } catch (err) {
        globals.logger.error(
            `AUDIT INFLUX INIT: Error getting list of InfluxDB v1 databases. ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Ensure InfluxDB v2 bucket exists for audit events.
 * Creates bucket if missing.
 *
 * @param {object} cfg Audit InfluxDB destination configuration.
 * @returns {Promise<void>} Resolves when initialization is complete.
 */
async function ensureInfluxV2BucketExists(cfg) {
    const org = cfg?.v2Config?.org;
    const bucketName = cfg?.v2Config?.bucket;
    const description = cfg?.v2Config?.description;
    const retentionDuration = cfg?.v2Config?.retentionDuration;

    if (!org || !bucketName) {
        globals.logger.warn('AUDIT INFLUX INIT: Missing v2 org/bucket; skipping init.');
        return;
    }

    const clientInfo = getAuditInfluxClient();
    if (!clientInfo?.client) {
        globals.logger.warn('AUDIT INFLUX INIT: No v2 client available; skipping init.');
        return;
    }

    let orgID;

    try {
        const orgsAPI = new OrgsAPI(clientInfo.client);
        const organizations = await orgsAPI.getOrgs({ org });
        if (!organizations || !organizations.orgs || !organizations.orgs.length) {
            globals.logger.error(`AUDIT INFLUX INIT: No organization named "${org}" found!`);
            return;
        }

        orgID = organizations.orgs[0].id;
        globals.logger.info(
            `AUDIT INFLUX INIT: Using organization "${org}" identified by "${orgID}"`
        );
    } catch (err) {
        globals.logger.error(
            `AUDIT INFLUX INIT: Error getting organisation: ${globals.getErrorMessage(err)}`
        );
        return;
    }

    try {
        const bucketsAPI = new BucketsAPI(clientInfo.client);

        try {
            const buckets = await bucketsAPI.getBuckets({ orgID, name: bucketName });
            if (buckets && buckets.buckets && buckets.buckets.length > 0) {
                const bucketID = buckets.buckets[0].id;
                globals.logger.info(
                    `AUDIT INFLUX INIT: Bucket named "${bucketName}" already exists, bucket ID="${bucketID}"`
                );
                return;
            }

            globals.logger.info(
                `AUDIT INFLUX INIT: Bucket named "${bucketName}" not found, creating it...`
            );
        } catch (e) {
            if (!(e instanceof HttpError && e.statusCode === 404)) {
                throw e;
            }

            globals.logger.info(
                `AUDIT INFLUX INIT: Bucket named "${bucketName}" not found (404), creating it...`
            );
        }

        await bucketsAPI.postBuckets({
            body: {
                orgID,
                name: bucketName,
                description,
                rp: retentionDuration,
            },
        });

        globals.logger.info(`AUDIT INFLUX INIT: Created new InfluxDB v2 bucket: ${bucketName}`);
    } catch (err) {
        globals.logger.error(
            `AUDIT INFLUX INIT: Error ensuring bucket exists: ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Initialize audit InfluxDB destination storage at startup.
 *
 * Behavior matches Butler SOS metrics InfluxDB initialization:
 * - v1: create database + retention policy if missing
 * - v2: create bucket if missing
 * - v3: never auto-created
 */
export async function initAuditInfluxDestination() {
    if (!isAuditApiEnabled()) return;
    if (!isAuditDestinationEnabled()) return;

    const destinationType = globals.config.has('Butler-SOS.auditEvents.destination.type')
        ? globals.config.get('Butler-SOS.auditEvents.destination.type')
        : null;

    if (destinationType !== 'influxdb') return;

    const cfg = getAuditInfluxConfig();
    if (!cfg || typeof cfg !== 'object') return;

    if (cfg.version === 1) {
        await ensureInfluxV1DatabaseExists(cfg);
        return;
    }

    if (cfg.version === 2) {
        await ensureInfluxV2BucketExists(cfg);
        return;
    }

    if (cfg.version === 3) {
        globals.logger.info(
            'AUDIT INFLUX INIT: InfluxDB v3 database is not auto-created; skipping.'
        );
        return;
    }

    globals.logger.warn(`AUDIT INFLUX INIT: Unsupported InfluxDB version v${cfg.version}`);
}
