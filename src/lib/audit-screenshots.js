import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import axios from 'axios';
import { DateTime } from 'luxon';

import globals from '../globals.js';
import { createCertificateOptions, getCertificates } from './cert-utils.js';
import { addTextHeaderToPng } from './audit-screenshot-metadata-image.js';

/**
 * Minimal logger interface used by this module.
 *
 * @typedef {object} Logger
 * @property {(msg: string) => void} info Logs informational messages.
 * @property {(msg: string) => void} warn Logs warning messages.
 * @property {(msg: string) => void} error Logs error messages.
 */

/**
 * Envelope metadata included with audit events.
 *
 * The fields are used to build deterministic filenames.
 *
 * @typedef {object} AuditEventEnvelope
 * @property {string} [timestamp] ISO-8601 timestamp (UTC recommended).
 * @property {string} [eventId] Unique event identifier.
 * @property {string} [correlationId] Correlation identifier used to link related events.
 */

/**
 * Flat-file screenshot storage target.
 *
 * @typedef {object} ScreenshotStorageTarget
 * @property {boolean} enable Whether to store screenshots for this target.
 * @property {'flat'} type Storage target type.
 * @property {string} directory Target directory where screenshots are written.
 */

/**
 * Qlik Sense QPS ticket request configuration.
 *
 * @typedef {object} QpsTicketConfig
 * @property {string} host QPS hostname.
 * @property {number} port QPS port.
 * @property {string} userDirectory Qlik user directory (e.g. "LAB").
 * @property {string} userId Qlik user id (e.g. "butler-sos").
 * @property {number} [ticketTimeoutMs] Request timeout for the QPS ticket call in milliseconds.
 */

/**
 * Screenshot authentication configuration.
 *
 * - `none`: fetch the screenshot URL as-is.
 * - `qpsTicket`: obtain a QPS ticket using mutual TLS and add `qlikTicket=<ticket>` to the URL.
 *
 * @typedef {object} ScreenshotAuthConfig
 * @property {'none'|'qpsTicket'} [mode] Authentication mode (defaults to `none`).
 * @property {QpsTicketConfig} [qps] QPS ticket settings (required when mode is `qpsTicket`).
 */

/**
 * @typedef {object} ScreenshotDownloadConfig
 * @property {boolean} enable Whether screenshot downloads are enabled.
 * @property {number} [downloadTimeoutMs] Timeout for the screenshot download request in milliseconds.
 * @property {ScreenshotAuthConfig} [auth] Screenshot authentication options.
 * @property {ScreenshotImageMetadataConfig} [addInImageMetadata] Optional metadata header rendered into PNG screenshots.
 * @property {ScreenshotStorageTarget[] | null} [storageTargets] Where to store downloaded screenshots.
 */

/**
 * Controls which metadata fields are rendered into the screenshot image.
 *
 * When `date` is enabled, two lines are rendered: UTC and server-local.
 *
 * @typedef {object} ScreenshotImageMetadataConfig
 * @property {boolean} [date] Render date lines (UTC and server-local).
 * @property {boolean} [eventId] Render envelope event id.
 * @property {boolean} [correlationId] Render envelope correlation id.
 * @property {boolean} [userId] Render the full user identifier string (often `DOMAIN\\user`).
 * @property {boolean} [appId] Render app id.
 * @property {boolean} [appName] Render app name.
 * @property {boolean} [sheetName] Render sheet name.
 */

/**
 * Generates an XRF key used by Qlik APIs (16 characters).
 *
 * @returns {string} 16-character XRF key.
 */
function generateXrfkey() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Creates an HTTPS agent configured with the globally configured Qlik client certificates.
 *
 * TLS server certificate verification is controlled via `Butler-SOS.serversToMonitor.rejectUnauthorized`.
 *
 * @returns {https.Agent} HTTPS agent for mutual TLS.
 */
function createQlikMutualTlsAgent() {
    const options = createCertificateOptions();
    const cert = getCertificates(options);

    return new https.Agent({
        cert: cert.cert,
        key: cert.key,
        ca: cert.ca,
        passphrase: options.CertificatePassphrase,
        rejectUnauthorized: globals.config.get('Butler-SOS.serversToMonitor.rejectUnauthorized'),
    });
}

/**
 * Requests a QPS ticket for a given user.
 *
 * Uses mutual TLS based on the global certificate configuration.
 *
 * @param {QpsTicketConfig} qps QPS ticket request settings.
 * @param {Logger} logger Logger.
 * @returns {Promise<string>} The QPS ticket.
 * @throws {Error} If the request fails or the response does not include a `Ticket` field.
 */
async function requestQpsTicket(qps, logger) {
    const xrfkey = generateXrfkey();
    const httpsAgent = createQlikMutualTlsAgent();
    const timeoutMs =
        typeof qps.ticketTimeoutMs === 'number' && qps.ticketTimeoutMs > 0
            ? qps.ticketTimeoutMs
            : 5000;

    const url = `https://${qps.host}:${qps.port}/qps/ticket?Xrfkey=${xrfkey}`;

    const requestSettings = {
        url,
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'X-Qlik-Xrfkey': xrfkey,
        },
        data: {
            UserDirectory: qps.userDirectory,
            UserId: qps.userId,
        },
        httpsAgent,
        timeout: timeoutMs,
        maxRedirects: 5,
    };

    const response = await axios.request(requestSettings);
    const ticket = response?.data?.Ticket;

    if (typeof ticket !== 'string' || ticket.length === 0) {
        logger.warn(
            `AUDIT API: QPS ticket response missing Ticket field. url=${url} status=${response?.status}`
        );
        throw new Error('QPS ticket response missing Ticket');
    }

    return ticket;
}

/**
 * Returns a new URL string with `qlikTicket` query param set.
 *
 * @param {string} rawUrl Original screenshot URL.
 * @param {string} ticket Qlik ticket.
 * @returns {string} Updated URL.
 */
function withQlikTicket(rawUrl, ticket) {
    const u = new URL(rawUrl);
    u.searchParams.set('qlikTicket', ticket);
    return u.toString();
}

/**
 * Extracts relevant context from an audit envelope for logging.
 *
 * This function is defensive: it treats the envelope as untrusted input and
 * only pulls a small set of known fields.
 *
 * @param {unknown} envelope Raw audit event envelope.
 * @returns {AuditContext} Extracted context values suitable for logging.
 */
function extractAuditContext(envelope) {
    const env = envelope && typeof envelope === 'object' ? envelope : null;
    const payload = env && 'payload' in env ? env.payload : null;
    const payloadObj = payload && typeof payload === 'object' ? payload : null;
    const ctx = payloadObj && 'context' in payloadObj ? payloadObj.context : null;
    const ctxObj = ctx && typeof ctx === 'object' ? ctx : null;
    const event = payloadObj && 'event' in payloadObj ? payloadObj.event : null;
    const eventObj = event && typeof event === 'object' ? event : null;

    /**
     * Reads a non-empty string field from a potentially untrusted object.
     *
     * @param {unknown} o Candidate object.
     * @param {string} k Field name.
     * @returns {string | undefined} Field value if present and non-empty.
     */
    const readString = (o, k) => {
        if (!o || typeof o !== 'object') return undefined;
        const v = o[k];
        return typeof v === 'string' && v.length > 0 ? v : undefined;
    };

    /**
     * Reads a finite number field from a potentially untrusted object.
     *
     * @param {unknown} o Candidate object.
     * @param {string} k Field name.
     * @returns {number | undefined} Field value if present and finite.
     */
    const readNumber = (o, k) => {
        if (!o || typeof o !== 'object') return undefined;
        const v = o[k];
        return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    };

    return {
        eventId: readString(env, 'eventId'),
        correlationId: readString(env, 'correlationId'),
        timestamp: readString(env, 'timestamp'),
        type: readString(env, 'type'),
        user: readString(ctxObj, 'user'),
        appId: readString(ctxObj, 'appId'),
        appName: readString(ctxObj, 'appName'),
        sheetId: readString(ctxObj, 'sheetId'),
        sheetName: readString(ctxObj, 'sheetName'),
        objectId: readString(eventObj, 'objectId'),
        objectName: readString(eventObj, 'objectName'),
        objectType: readString(eventObj, 'objectType'),
        screenshotFormat: readString(eventObj, 'format'),
        screenshotWidth: readNumber(eventObj, 'width'),
        screenshotHeight: readNumber(eventObj, 'height'),
    };
}

/**
 * Extracted audit context used for log enrichment.
 *
 * @typedef {object} AuditContext
 * @property {string} [eventId] Event identifier.
 * @property {string} [correlationId] Correlation identifier.
 * @property {string} [timestamp] ISO-8601 timestamp.
 * @property {string} [type] Event type.
 * @property {string} [user] User identifier.
 * @property {string} [appId] Qlik Sense app identifier.
 * @property {string} [appName] Qlik Sense app name.
 * @property {string} [sheetId] Sheet identifier.
 * @property {string} [sheetName] Sheet name.
 * @property {string} [objectId] Object identifier.
 * @property {string} [objectName] Object name.
 * @property {string} [objectType] Object type.
 * @property {string} [screenshotFormat] Screenshot format (e.g. png/jpg).
 * @property {number} [screenshotWidth] Screenshot width in pixels.
 * @property {number} [screenshotHeight] Screenshot height in pixels.
 */

/**
 * Converts a context object into a compact `k=v` string.
 *
 * Empty/undefined values are omitted.
 *
 * @param {Record<string, unknown>} context Context values to serialize.
 * @returns {string} Space-separated `k=v` pairs.
 */
function formatContextForLog(context) {
    if (!context || typeof context !== 'object') return '';

    const parts = [];
    for (const [key, value] of Object.entries(context)) {
        if (value === undefined || value === null || value === '') continue;
        parts.push(`${key}=${value}`);
    }
    return parts.join(' ');
}

/**
 * Returns true if an HTTP status is likely transient and worth retrying.
 *
 * @param {number} status HTTP status code.
 * @returns {boolean} True if the status should be retried.
 */
function isRetryableHttpStatus(status) {
    return [404, 408, 425, 429, 500, 502, 503, 504].includes(status);
}

/**
 * Sleep helper used for retry backoff.
 *
 * @param {number} ms Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a richer error string for axios errors.
 *
 * @param {unknown} err Error thrown by axios or other code.
 * @returns {string} Human-readable error summary.
 */
function formatAxiosError(err) {
    if (axios.isAxiosError && axios.isAxiosError(err)) {
        const status = err.response?.status;
        const code = err.code;
        const message = err.message;
        return `AxiosError message='${message}' code=${code || 'n/a'} status=${
            typeof status === 'number' ? status : 'n/a'
        }`;
    }

    if (err instanceof Error) {
        return `${err.name} message='${err.message}'`;
    }

    return String(err);
}

/**
 * Sanitizes a string so it is safe to use as part of a filename.
 *
 * - Non-string or empty values are mapped to the literal string `none`.
 * - Unsafe characters are replaced with `_`.
 * - Output is capped to 128 characters.
 *
 * @param {unknown} value The value to sanitize.
 * @returns {string} Sanitized filename component.
 */
function sanitizeFilenameComponent(value) {
    if (typeof value !== 'string' || value.length === 0) return 'none';
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
}

/**
 * Formats an ISO timestamp into a filesystem-friendly UTC string.
 *
 * If the timestamp is missing, current time is used.
 * If parsing fails, `invalid_timestamp` is returned.
 *
 * @param {string | null | undefined} timestamp ISO-8601 timestamp.
 * @returns {string} A UTC timestamp formatted as `YYYYMMDDThhmmss.mmmZ`.
 */
function formatTimestampForFilename(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(date.getTime())) return 'invalid_timestamp';

    /**
     * Pads a number with leading zeroes.
     *
     * @param {number} n Number to pad.
     * @param {number} [width] Target width (defaults to 2).
     * @returns {string} Padded string.
     */
    const pad = (n, width = 2) => String(n).padStart(width, '0');

    const yyyy = date.getUTCFullYear();
    const mm = pad(date.getUTCMonth() + 1);
    const dd = pad(date.getUTCDate());
    const hh = pad(date.getUTCHours());
    const mi = pad(date.getUTCMinutes());
    const ss = pad(date.getUTCSeconds());
    const ms = pad(date.getUTCMilliseconds(), 3);

    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}.${ms}Z`;
}

/**
 * Maps an HTTP Content-Type value to a preferred image file extension.
 *
 * Only a small allow-list is supported; unsupported types return `null`.
 *
 * @param {string | null | undefined} contentType Content-Type header value.
 * @returns {string | null} File extension without dot (e.g. `png`), or null.
 */
function extensionFromContentType(contentType) {
    if (typeof contentType !== 'string') return null;
    const ct = contentType.split(';')[0].trim().toLowerCase();
    if (ct === 'image/png') return 'png';
    if (ct === 'image/jpeg') return 'jpg';
    if (ct === 'image/webp') return 'webp';
    if (ct === 'image/gif') return 'gif';
    return null;
}

/**
 * Normalizes a possibly-empty value into a printable metadata string.
 *
 * @param {unknown} value Candidate value.
 * @returns {string} The value if it is a non-empty string, otherwise `n/a`.
 */
function safeMetadataValue(value) {
    return typeof value === 'string' && value.length > 0 ? value : 'n/a';
}

/**
 * Formats an ISO-8601 timestamp into UTC and server-local time.
 *
 * @param {string | null | undefined} timestamp ISO-8601 timestamp.
 * @returns {{ utc: string, local: string }} Formatted timestamps.
 */
function formatTimestampUtcAndLocal(timestamp) {
    const dt =
        typeof timestamp === 'string' && timestamp.length > 0
            ? DateTime.fromISO(timestamp, { setZone: true })
            : DateTime.utc();

    if (!dt.isValid) {
        return {
            utc: 'invalid_timestamp',
            local: 'invalid_timestamp',
        };
    }

    return {
        utc: dt.toUTC().toFormat('yyyy-LL-dd HH:mm:ss'),
        local: dt.toLocal().toFormat('yyyy-LL-dd HH:mm:ss'),
    };
}

/**
 * Checks whether any metadata flag is enabled.
 *
 * @param {ScreenshotImageMetadataConfig | null | undefined} flags Metadata flags.
 * @returns {boolean} True if at least one flag is set to true.
 */
function hasAnyEnabledMetadataFlag(flags) {
    if (!flags || typeof flags !== 'object') return false;
    return Object.values(flags).some((v) => v === true);
}

/**
 * Builds the list of metadata lines to render into the screenshot image.
 *
 * @param {AuditEventEnvelope | null | undefined} envelope Audit envelope.
 * @param {AuditContext} auditCtx Extracted audit context.
 * @param {ScreenshotImageMetadataConfig | null | undefined} flags Metadata flags.
 * @returns {Array<{ key: string, value: string }>} Lines to render.
 */
function buildScreenshotMetadataLines(envelope, auditCtx, flags) {
    if (!hasAnyEnabledMetadataFlag(flags)) return [];

    const lines = [];

    if (flags.date === true) {
        const { utc, local } = formatTimestampUtcAndLocal(envelope?.timestamp);
        lines.push({ key: 'DATE (UTC)', value: utc });
        lines.push({ key: 'DATE (LOCAL)', value: local });
    }

    if (flags.eventId === true)
        lines.push({ key: 'EVENT ID', value: safeMetadataValue(envelope?.eventId) });
    if (flags.correlationId === true)
        lines.push({ key: 'CORRELATION ID', value: safeMetadataValue(envelope?.correlationId) });

    if (flags.userId === true) {
        lines.push({ key: 'USER ID', value: safeMetadataValue(auditCtx?.user) });
    }

    if (flags.appId === true)
        lines.push({ key: 'APP ID', value: safeMetadataValue(auditCtx?.appId) });
    if (flags.appName === true)
        lines.push({ key: 'APP NAME', value: safeMetadataValue(auditCtx?.appName) });
    if (flags.sheetName === true)
        lines.push({ key: 'SHEET NAME', value: safeMetadataValue(auditCtx?.sheetName) });

    return lines;
}

/**
 * Builds the output filename for the metadata-enhanced screenshot image.
 *
 * @param {string} originalFilename Original screenshot filename.
 * @returns {string} Filename with `_metadata` inserted before extension.
 */
function buildMetadataFilename(originalFilename) {
    if (typeof originalFilename !== 'string' || originalFilename.length === 0) {
        return 'screenshot_metadata';
    }

    const ext = path.extname(originalFilename);
    if (!ext) return `${originalFilename}_metadata`;
    const base = originalFilename.slice(0, -ext.length);
    return `${base}_metadata${ext}`;
}

/**
 * Attempts to infer an image file extension from the URL path.
 *
 * Only a small allow-list is supported; unsupported/unknown extensions return `null`.
 * `jpeg` is normalized to `jpg`.
 *
 * @param {string} url Screenshot URL.
 * @returns {string | null} File extension without dot (e.g. `jpg`), or null.
 */
function extensionFromUrl(url) {
    try {
        const u = new URL(url);
        const ext = path.extname(u.pathname).toLowerCase().replace('.', '');
        if (!ext) return null;
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext))
            return ext === 'jpeg' ? 'jpg' : ext;
        return null;
    } catch {
        return null;
    }
}

/**
 * Axios `validateStatus` helper that accepts all HTTP statuses.
 *
 * This lets the caller handle non-2xx responses explicitly based on status code.
 *
 * @param {number} _status HTTP status code.
 * @returns {boolean} Always true.
 */
function acceptAllHttpStatuses(_status) {
    return true;
}

/**
 * Builds a unique filename for a screenshot.
 *
 * Required uniqueness properties:
 * - timestamp + eventId + correlationId
 *
 * If `contentType` is a supported image type, it is used to select the extension.
 * Otherwise the extension is inferred from the URL path; if that fails, `bin` is used.
 *
 * @param {AuditEventEnvelope | null | undefined} envelope Envelope metadata used to create the filename.
 * @param {string} url Screenshot URL (used to infer extension if needed).
 * @param {string | null | undefined} contentType HTTP Content-Type header value (preferred for extension selection).
 * @returns {string} Filename in the format `${timestamp}_${eventId}_${correlationId}.${ext}`.
 */
export function buildScreenshotFilename(envelope, url, contentType) {
    const ts = formatTimestampForFilename(envelope?.timestamp);
    const eventId = sanitizeFilenameComponent(envelope?.eventId);
    const correlationId = sanitizeFilenameComponent(envelope?.correlationId);

    const ext = extensionFromContentType(contentType) || extensionFromUrl(url) || 'bin';

    return `${ts}_${eventId}_${correlationId}.${ext}`;
}

/**
 * Downloads a screenshot URL and stores it to all enabled storage targets.
 *
 * Notes:
 * - This function is "best effort" and logs warnings on failures.
 * - When authentication mode is `qpsTicket`, a QPS ticket is requested and appended as `qlikTicket`.
 * - If the response `Content-Type` is present and not an image type, the file is not written.
 *
 * @param {string} url Screenshot URL.
 * @param {AuditEventEnvelope | null | undefined} envelope Envelope metadata (used for filename generation).
 * @param {ScreenshotDownloadConfig} config Screenshot download configuration.
 * @param {Logger} logger Logger.
 * @returns {Promise<void>} Resolves when the attempt completes.
 */
export async function downloadScreenshot(url, envelope, config, logger) {
    if (!config?.enable) return;

    const targets = Array.isArray(config.storageTargets)
        ? config.storageTargets.filter((t) => t && t.enable === true)
        : [];

    if (targets.length === 0) {
        logger.warn('AUDIT API: Screenshot download enabled, but no storageTargets are enabled');
        return;
    }

    const auditCtx = extractAuditContext(envelope);
    const auditCtxStr = formatContextForLog(auditCtx);

    const timeoutMs =
        typeof config.downloadTimeoutMs === 'number' && config.downloadTimeoutMs > 0
            ? config.downloadTimeoutMs
            : 15000;

    const authMode = config?.auth?.mode || 'none';
    const maxAttempts = 3;
    const baseDelayMs = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let downloadUrl = url;
        let httpsAgent;

        try {
            if (authMode === 'qpsTicket') {
                const qps = config?.auth?.qps;
                if (!qps?.host || !qps?.port || !qps?.userDirectory || !qps?.userId) {
                    logger.warn(
                        `AUDIT API: Screenshot auth mode is qpsTicket, but QPS settings are missing. ${auditCtxStr}`
                    );
                    return;
                }

                const ticket = await requestQpsTicket(qps, logger);
                downloadUrl = withQlikTicket(url, ticket);
                httpsAgent = createQlikMutualTlsAgent();
            }

            const response = await axios.request({
                url: downloadUrl,
                method: 'get',
                responseType: 'arraybuffer',
                httpsAgent,
                timeout: timeoutMs,
                maxRedirects: 5,
                validateStatus: acceptAllHttpStatuses,
            });

            const contentType = response.headers?.['content-type'] || null;
            const buffer = Buffer.from(response.data);

            // Non-2xx
            if (response.status < 200 || response.status >= 300) {
                const retryable = isRetryableHttpStatus(response.status);

                if (retryable && attempt < maxAttempts) {
                    const delayMs = baseDelayMs * 2 ** (attempt - 1);
                    logger.info(
                        `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms httpStatus=${
                            response.status
                        } url=${downloadUrl} (original=${url}) ${auditCtxStr}`
                    );
                    await sleep(delayMs);
                    continue;
                }

                const level = retryable ? 'error' : 'warn';
                logger[level](
                    `AUDIT API: Screenshot download failed httpStatus=${response.status} url=${downloadUrl} (original=${url}) attempt=${attempt}/${maxAttempts} ${auditCtxStr}`
                );
                return;
            }

            // 2xx but not an image
            if (
                typeof contentType === 'string' &&
                !contentType.toLowerCase().startsWith('image/')
            ) {
                const preview = buffer
                    .subarray(0, 200)
                    .toString('utf8')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (attempt < maxAttempts) {
                    const delayMs = baseDelayMs * 2 ** (attempt - 1);
                    logger.info(
                        `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms nonImageContentType='${
                            contentType
                        }' url=${downloadUrl} (original=${url}) ${auditCtxStr}`
                    );
                    await sleep(delayMs);
                    continue;
                }

                logger.error(
                    `AUDIT API: Screenshot download returned non-image content-type='${contentType}'. url=${downloadUrl} (original=${url}) attempt=${attempt}/${maxAttempts} preview='${preview}' ${auditCtxStr}`
                );
                return;
            }

            const filename = buildScreenshotFilename(envelope, url, contentType);

            const ext = extensionFromContentType(contentType) || extensionFromUrl(url);
            const metadataFlags = config?.addInImageMetadata;
            const shouldAddMetadata = ext === 'png' && hasAnyEnabledMetadataFlag(metadataFlags);
            const metadataLines = shouldAddMetadata
                ? buildScreenshotMetadataLines(envelope, auditCtx, metadataFlags)
                : [];

            let metadataBuffer;
            if (shouldAddMetadata && metadataLines.length > 0) {
                try {
                    metadataBuffer = addTextHeaderToPng(buffer, metadataLines, {
                        valueMaxChars: 160,
                    });
                } catch (err) {
                    logger.warn(
                        `AUDIT API: Failed to add metadata header to screenshot PNG. error=${formatAxiosError(
                            err
                        )} ${auditCtxStr}`
                    );
                    metadataBuffer = undefined;
                }
            }

            for (const target of targets) {
                if (target.type !== 'flat') continue;

                const directoryPath = path.resolve(target.directory);
                await fs.mkdir(directoryPath, { recursive: true });

                const filePath = path.join(directoryPath, filename);
                await fs.writeFile(filePath, buffer);

                logger.info(`AUDIT API: Saved screenshot file=${filePath}`);

                if (metadataBuffer && metadataBuffer.length > 0) {
                    const metadataFilename = buildMetadataFilename(filename);
                    const metadataFilePath = path.join(directoryPath, metadataFilename);
                    await fs.writeFile(metadataFilePath, metadataBuffer);
                    logger.info(`AUDIT API: Saved screenshot metadata file=${metadataFilePath}`);
                }
            }

            return;
        } catch (err) {
            if (attempt < maxAttempts) {
                const delayMs = baseDelayMs * 2 ** (attempt - 1);
                logger.info(
                    `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms error=${formatAxiosError(
                        err
                    )} url=${downloadUrl} (original=${url}) ${auditCtxStr}`
                );
                await sleep(delayMs);
                continue;
            }

            logger.error(
                `AUDIT API: Screenshot download failed after ${maxAttempts} attempts. error=${formatAxiosError(
                    err
                )} url=${downloadUrl} (original=${url}) ${auditCtxStr}`
            );
            return;
        }
    }
}
