import { Point, HttpError } from '@influxdata/influxdb-client';
import { Point as Point3 } from '@influxdata/influxdb3-client';
import { OrgsAPI, BucketsAPI } from '@influxdata/influxdb-client-apis';

import globals from '../../../globals.js';
import { writeToInfluxWithRetry } from '../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from './shared/client.js';
import { buildAuditInfluxPointModel } from './shared/mapping.js';

let auditInfluxBuffer = [];
let flushTimer = null;
let flushQueued = false;
let configKey = null;
let ensuredBucketKey = null;

/**
 * Ensure the audit InfluxDB v2 bucket exists.
 * Mirrors the behavior used for metrics (create bucket on 404 and include description).
 *
 * @param {object} cfg Influx destination config.
 * @param {unknown} client Influx v2 client.
 * @returns {Promise<void>}
 */
async function ensureAuditInfluxBucketV2(cfg, client) {
    const key = getConfigKey(cfg);
    if (ensuredBucketKey === key) return;

    const org = cfg?.v2Config?.org;
    const bucketName = cfg?.v2Config?.bucket;
    const description = cfg?.v2Config?.description;
    const retentionDuration = cfg?.v2Config?.retentionDuration;

    if (!org || !bucketName || !retentionDuration) {
        throw new Error('Missing required audit InfluxDB v2 config (org/bucket/retentionDuration)');
    }

    let orgID;
    try {
        const orgsAPI = new OrgsAPI(client);
        const organizations = await orgsAPI.getOrgs({ org });

        if (!organizations || !organizations.orgs || !organizations.orgs.length) {
            throw new Error(`No organization named "${org}" found`);
        }

        orgID = organizations.orgs[0].id;
        globals.logger.verbose(
            `AUDIT INFLUX V2: Using organization "${org}" identified by "${orgID}"`
        );
    } catch (err) {
        throw new Error(`Failed to resolve audit InfluxDB v2 org: ${globals.getErrorMessage(err)}`);
    }

    try {
        const bucketsAPI = new BucketsAPI(client);
        try {
            const buckets = await bucketsAPI.getBuckets({ orgID, name: bucketName });
            if (buckets && buckets.buckets && buckets.buckets.length > 0) {
                const bucketID = buckets.buckets[0].id;
                globals.logger.verbose(
                    `AUDIT INFLUX V2: Bucket named "${bucketName}" already exists, bucket ID="${bucketID}"`
                );
                ensuredBucketKey = key;
                return;
            }
        } catch (e) {
            if (e instanceof HttpError && e.statusCode === 404) {
                globals.logger.info(
                    `AUDIT INFLUX V2: Bucket named "${bucketName}" not found, creating it...`
                );

                await bucketsAPI.postBuckets({
                    body: {
                        orgID,
                        name: bucketName,
                        description,
                        rp: retentionDuration,
                    },
                });

                ensuredBucketKey = key;
                return;
            }
            throw e;
        }

        // If we get here, getBuckets didn't error but also didn't return a bucket.
        // Treat as non-existent and try to create.
        globals.logger.info(
            `AUDIT INFLUX V2: Bucket named "${bucketName}" not found, creating it...`
        );
        await bucketsAPI.postBuckets({
            body: {
                orgID,
                name: bucketName,
                description,
                rp: retentionDuration,
            },
        });

        ensuredBucketKey = key;
    } catch (err) {
        throw new Error(
            `Failed to ensure audit InfluxDB v2 bucket: ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Split an array into chunks.
 *
 * @template T
 * @param {T[]} arr Array to chunk.
 * @param {number} chunkSize Max items per chunk.
 * @returns {T[][]} Chunked arrays.
 */
function chunkArray(arr, chunkSize) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    if (!chunkSize || chunkSize <= 0) return [arr];

    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Returns true if audit destinations are enabled.
 *
 * @returns {boolean} True when audit destinations are enabled.
 */
function getAuditDestinationEnabled() {
    return (
        globals.config.has('Butler-SOS.auditEvents.destination.enable') &&
        globals.config.get('Butler-SOS.auditEvents.destination.enable') === true
    );
}

/**
 * Returns the audit-specific Influx destination config subtree.
 *
 * @returns {object} Config subtree.
 */
function getAuditInfluxConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.influxdb');
}

/**
 * Create a cache key for buffering state, so we can reset safely when config changes.
 *
 * @param {object} cfg Influx destination config.
 * @returns {string} Deterministic key.
 */
function getConfigKey(cfg) {
    return JSON.stringify({
        host: cfg?.host,
        port: cfg?.port,
        version: cfg?.version,
        maxBatchSize: cfg?.maxBatchSize,
        writeFrequency: cfg?.writeFrequency,
        measurementName: cfg?.measurementName,
        staticTags: cfg?.staticTags,
        v1: cfg?.v1Config,
        v2: cfg?.v2Config,
        v3: cfg?.v3Config,
    });
}

/**
 * Stop the interval-based flush timer.
 *
 * @returns {void}
 */
function stopFlushTimer() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}

/**
 * Ensure the interval-based flush timer exists when buffering is enabled.
 *
 * @param {object} cfg Influx destination config.
 * @returns {void}
 */
function ensureFlushTimer(cfg) {
    const writeFrequency = cfg?.writeFrequency ?? 0;

    if (!getAuditDestinationEnabled() || writeFrequency <= 0) {
        stopFlushTimer();
        return;
    }

    if (flushTimer) return;

    flushTimer = setInterval(() => {
        requestFlush('interval');
    }, writeFrequency);
}

/**
 * Enqueue a buffer flush.
 *
 * If the audit events queue manager exists, the flush is queued to preserve existing
 * backpressure semantics.
 *
 * @param {string} _reason Flush trigger reason (for future logging).
 * @returns {void}
 */
function requestFlush(_reason) {
    if (flushQueued) return;
    flushQueued = true;

    const queueManager = globals.auditEventsQueueManager;

    /**
     * Flush runner invoked from a queue job.
     *
     * @returns {Promise<void>} Resolves when flush attempt finishes.
     */
    const run = async () => {
        try {
            await flushNow();
        } finally {
            flushQueued = false;
        }
    };

    // Keep backpressure semantics when queue manager exists.
    if (queueManager?.addToQueue) {
        queueManager
            .addToQueue(run)
            .catch((err) =>
                globals.logger.error(
                    `AUDIT INFLUX BUFFER: Failed to enqueue flush: ${globals.getErrorMessage(err)}`
                )
            )
            .finally(() => {
                // If enqueue fails, allow future flush attempts.
                flushQueued = false;
            });
        return;
    }

    // Fallback: flush directly when queue manager isn't available.
    void run();
}

/**
 * Write datapoints to InfluxDB v1 using progressive batch sizes.
 *
 * @param {Array} datapoints Datapoints to write.
 * @param {unknown} client Influx v1 client.
 * @param {string} context Log context.
 * @param {string} errorCategory Error category.
 * @param {number} maxBatchSize Maximum batch size.
 * @returns {Promise<void>}
 */
async function writeBatchV1(datapoints, client, context, errorCategory, maxBatchSize) {
    if (!Array.isArray(datapoints) || datapoints.length === 0) return;

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter((s) => s <= maxBatchSize);

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(datapoints, batchSize);
        let allSucceeded = true;
        let failedChunks = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, datapoints.length - 1);

            try {
                await writeToInfluxWithRetry(
                    async () => await client.writePoints(chunk),
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v1',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks++;
                globals.logger.error(
                    `AUDIT INFLUX V1 BATCH: ${context} - Chunk ${i + 1}/${chunks.length} failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) return;

        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `AUDIT INFLUX V1 BATCH: ${context} - ${failedChunks} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            throw new Error('Failed to write audit batch after trying all progressive sizes');
        }
    }
}

/**
 * Write points to InfluxDB v2 using progressive batch sizes.
 *
 * @param {Array} points Points to write.
 * @param {unknown} client Influx v2 client.
 * @param {string} org Influx org.
 * @param {string} bucket Influx bucket.
 * @param {string} context Log context.
 * @param {string} errorCategory Error category.
 * @param {number} maxBatchSize Maximum batch size.
 * @returns {Promise<void>}
 */
async function writeBatchV2(points, client, org, bucket, context, errorCategory, maxBatchSize) {
    if (!Array.isArray(points) || points.length === 0) return;

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter((s) => s <= maxBatchSize);

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(points, batchSize);
        let allSucceeded = true;
        let failedChunks = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, points.length - 1);

            try {
                await writeToInfluxWithRetry(
                    async () => {
                        const writeApi = client.getWriteApi(org, bucket, 'ns', {
                            flushInterval: 5000,
                            maxRetries: 0,
                        });

                        try {
                            await writeApi.writePoints(chunk);
                            await writeApi.close();
                        } catch (err) {
                            try {
                                await writeApi.close();
                            } catch (closeErr) {
                                // ignore
                            }
                            throw err;
                        }
                    },
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v2',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks++;
                globals.logger.error(
                    `AUDIT INFLUX V2 BATCH: ${context} - Chunk ${i + 1}/${chunks.length} failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) return;

        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `AUDIT INFLUX V2 BATCH: ${context} - ${failedChunks} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            throw new Error('Failed to write audit batch after trying all progressive sizes');
        }
    }
}

/**
 * Write points to InfluxDB v3 using progressive batch sizes.
 *
 * @param {Array} points Points to write.
 * @param {unknown} client Influx v3 client.
 * @param {string} database Influx v3 database.
 * @param {string} context Log context.
 * @param {string} errorCategory Error category.
 * @param {number} maxBatchSize Maximum batch size.
 * @returns {Promise<void>}
 */
async function writeBatchV3(points, client, database, context, errorCategory, maxBatchSize) {
    if (!Array.isArray(points) || points.length === 0) return;

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter((s) => s <= maxBatchSize);

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(points, batchSize);
        let allSucceeded = true;
        let failedChunks = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, points.length - 1);

            try {
                const lineProtocol = chunk.map((p) => p.toLineProtocol()).join('\n');

                await writeToInfluxWithRetry(
                    async () => await client.write(lineProtocol, database),
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v3',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks++;
                globals.logger.error(
                    `AUDIT INFLUX V3 BATCH: ${context} - Chunk ${i + 1}/${chunks.length} failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) return;

        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `AUDIT INFLUX V3 BATCH: ${context} - ${failedChunks} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            throw new Error('Failed to write audit batch after trying all progressive sizes');
        }
    }
}

/**
 * Write buffered points according to the configured InfluxDB version.
 *
 * @param {Array} pointsToWrite Points to write.
 * @param {object} cfg Influx destination config.
 * @returns {Promise<void>}
 */
async function writeBufferedPoints(pointsToWrite, cfg) {
    const maxBatchSize = cfg?.maxBatchSize ?? 1000;

    const clientInfo = getAuditInfluxClient();
    if (!clientInfo?.client) return;

    if (cfg.version === 1) {
        await writeBatchV1(
            pointsToWrite,
            clientInfo.client,
            'Audit events',
            'audit-events',
            maxBatchSize
        );
        return;
    }

    if (cfg.version === 2) {
        await ensureAuditInfluxBucketV2(cfg, clientInfo.client);
        await writeBatchV2(
            pointsToWrite,
            clientInfo.client,
            clientInfo.org,
            clientInfo.bucket,
            'Audit events',
            'audit-events',
            maxBatchSize
        );
        return;
    }

    if (cfg.version === 3) {
        await writeBatchV3(
            pointsToWrite,
            clientInfo.client,
            clientInfo.database,
            'Audit events',
            'audit-events',
            maxBatchSize
        );
        return;
    }

    globals.logger.warn(`AUDIT INFLUX BUFFER: Unsupported InfluxDB version v${cfg.version}`);
}

/**
 * Build a version-specific point representation from a version-agnostic model.
 *
 * @param {{ measurementName: string, timestampMs?: number, tags: Record<string,string>, fields: Record<string, string|number|boolean> }} model Point model.
 * @param {number} version InfluxDB major version.
 * @returns {unknown} Version-specific point.
 */
function buildPointForVersion(model, version) {
    if (version === 1) {
        return {
            measurement: model.measurementName,
            tags: model.tags,
            fields: model.fields,
            ...(model.timestampMs ? { timestamp: new Date(model.timestampMs) } : {}),
        };
    }

    if (version === 2) {
        const point = new Point(model.measurementName);

        for (const [k, v] of Object.entries(model.tags)) {
            if (v !== undefined && v !== null) {
                point.tag(k, String(v));
            }
        }

        for (const [k, v] of Object.entries(model.fields)) {
            if (typeof v === 'number') {
                point.floatField(k, v);
            } else if (typeof v === 'boolean') {
                point.booleanField(k, v);
            } else if (typeof v === 'string') {
                point.stringField(k, v);
            }
        }

        if (model.timestampMs) {
            point.timestamp(new Date(model.timestampMs));
        }

        return point;
    }

    if (version === 3) {
        const point = new Point3(model.measurementName);

        for (const [k, v] of Object.entries(model.tags)) {
            if (v !== undefined && v !== null) {
                point.setTag(k, String(v));
            }
        }

        for (const [k, v] of Object.entries(model.fields)) {
            if (typeof v === 'number') {
                point.setFloatField(k, v);
            } else if (typeof v === 'boolean') {
                point.setBooleanField(k, v);
            } else if (typeof v === 'string') {
                point.setStringField(k, v);
            }
        }

        if (model.timestampMs) {
            point.setTimestamp(new Date(model.timestampMs));
        }

        return point;
    }

    return null;
}

/**
 * Enqueue an audit event for buffered writing to InfluxDB.
 *
 * Hybrid behavior:
 * - Buffer points in memory.
 * - Flush at `writeFrequency`.
 * - Flush immediately when buffer reaches `maxBatchSize`.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 */
export function bufferAuditInfluxEvent(envelope, extras = {}) {
    if (!getAuditDestinationEnabled()) {
        auditInfluxBuffer = [];
        stopFlushTimer();
        return;
    }

    const cfg = getAuditInfluxConfig();
    if (!cfg) return;

    const key = getConfigKey(cfg);
    if (configKey && configKey !== key) {
        globals.logger.warn(
            'AUDIT INFLUX BUFFER: Destination config changed; clearing buffered points to avoid mixing configs.'
        );
        auditInfluxBuffer = [];
        stopFlushTimer();
        flushQueued = false;
    }
    configKey = key;

    ensureFlushTimer(cfg);

    const model = buildAuditInfluxPointModel(envelope, extras);
    const point = buildPointForVersion(model, cfg.version);
    if (!point) return;

    auditInfluxBuffer.push(point);

    const maxBatchSize = cfg.maxBatchSize ?? 1000;
    const writeFrequency = cfg.writeFrequency ?? 0;

    // Hybrid: size-triggered flush.
    if (auditInfluxBuffer.length >= maxBatchSize) {
        requestFlush('maxBatchSize');
        return;
    }

    // If buffering is disabled, flush immediately per event.
    if (writeFrequency <= 0) {
        requestFlush('immediate');
    }
}

/**
 * Flush buffered audit points to InfluxDB now.
 */
export async function flushNow() {
    if (!getAuditDestinationEnabled()) return;

    const cfg = getAuditInfluxConfig();
    if (!cfg) return;

    if (auditInfluxBuffer.length === 0) return;

    const pointsToWrite = auditInfluxBuffer.splice(0, auditInfluxBuffer.length);

    try {
        await writeBufferedPoints(pointsToWrite, cfg);
        globals.logger.verbose(
            `AUDIT INFLUX BUFFER: Flushed ${pointsToWrite.length} point(s) to InfluxDB`
        );
    } catch (err) {
        // Put points back to retry later.
        auditInfluxBuffer.unshift(...pointsToWrite);
        globals.logger.error(
            `AUDIT INFLUX BUFFER: Flush failed; will retry later: ${globals.getErrorMessage(err)}`
        );
    }
}
