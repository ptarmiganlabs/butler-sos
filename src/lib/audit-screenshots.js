import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import axios from 'axios';
import { DateTime } from 'luxon';
import setCookieParser from 'set-cookie-parser';

import pngjs from 'pngjs';

import globals from '../globals.js';
import { createCertificateOptions, getCertificates } from './cert-utils.js';
import { addTextHeaderToPng } from './audit-screenshot-metadata-image.js';
import { extractVirtualProxyFromSessionCookieName } from './util/qlik-session-utils.js';

const { PNG } = pngjs;

/**
 * Minimal logger interface used by this module.
 *
 * @typedef {object} Logger
 * @property {(msg: string) => void} [debug] Logs debug messages.
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
 * @property {boolean} [selectionTxnId] Render selection transaction id (payload.event.selectionTxnId).
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

    debugLog(
        logger,
        `AUDIT API: Requesting QPS ticket qpsHost=${qps.host} qpsPort=${qps.port} qpsPath=/qps/ticket userDirectory=${qps.userDirectory} userId=${qps.userId} timeoutMs=${timeoutMs}`
    );

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

    debugLog(
        logger,
        `AUDIT API: QPS ticket response status=${response?.status ?? 'n/a'} ticketPresent=${
            typeof ticket === 'string' && ticket.length > 0
        } ticketLength=${typeof ticket === 'string' ? ticket.length : 0}`
    );

    if (typeof ticket !== 'string' || ticket.length === 0) {
        logger.warn(
            `AUDIT API: QPS ticket response missing Ticket field. url=${url} status=${response?.status}`
        );
        throw new Error('QPS ticket response missing Ticket');
    }

    return ticket;
}

/**
 * Deletes a Qlik Sense session.
 *
 * @param {object} qps QPS settings.
 * @param {string} cookieName The name of the session cookie.
 * @param {string} sessionId The session ID to delete.
 * @param {Logger} logger Logger.
 */
async function deleteQpsSession(qps, cookieName, sessionId, logger) {
    if (!sessionId || !cookieName) return;

    try {
        const xrfkey = generateXrfkey();
        const httpsAgent = createQlikMutualTlsAgent();
        const vp = extractVirtualProxyFromSessionCookieName(cookieName);

        // Endpoint to delete a specific session: /qps/{vp}/session/{id}
        const vpPath = vp ? `${vp}/` : '';
        const url = `https://${qps.host}:${qps.port}/qps/${vpPath}session/${sessionId}?Xrfkey=${xrfkey}`;

        debugLog(
            logger,
            `AUDIT API: Deleting QPS session qpsHost=${qps.host} qpsPort=${qps.port} virtualProxy=${
                vp || '(default)'
            } cookieName=${cookieName} sessionIdLength=${sessionId.length} url=${url.replace(
                sessionId,
                '[session-id-redacted]'
            )}`
        );

        await axios.request({
            url,
            method: 'delete',
            headers: { 'X-Qlik-Xrfkey': xrfkey },
            httpsAgent,
            timeout: 5000,
        });

        logger.verbose(
            `AUDIT API: Successfully deleted QPS session ${sessionId} for virtual proxy "${vp}"`
        );
    } catch (err) {
        logger.warn(`AUDIT API: Failed to delete QPS session ${sessionId}: ${err.message}`);
    }
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
        viewingDuration: readNumber(eventObj, 'duration'),
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
 * @property {number} [viewingDuration] Duration the object was in view (ms).
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
 * Writes a debug message when the provided logger supports debug logging.
 *
 * @param {Logger} logger Logger.
 * @param {string} message Message to log.
 */
function debugLog(logger, message) {
    if (logger && typeof logger.debug === 'function') {
        logger.debug(message);
    }
}

/**
 * Returns a URL string with any qlikTicket query value redacted.
 *
 * @param {string} rawUrl URL to redact.
 * @returns {string} Redacted URL, or the original string if parsing fails.
 */
function redactQlikTicketInUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        if (u.searchParams.has('qlikTicket')) {
            u.searchParams.set('qlikTicket', '[redacted]');
        }
        return u.toString();
    } catch {
        return rawUrl;
    }
}

/**
 * Builds a compact URL summary for debug logging.
 *
 * @param {string} rawUrl URL to summarize.
 * @returns {string} URL summary without sensitive query values.
 */
function summarizeUrlForDebug(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const queryKeys = Array.from(u.searchParams.keys()).join(',') || 'none';
        return `origin=${u.origin} path=${u.pathname} queryKeys=${queryKeys} serverNodeId=${
            u.searchParams.get('serverNodeId') || 'n/a'
        } hasQlikTicket=${u.searchParams.has('qlikTicket')}`;
    } catch {
        return 'invalidUrl=true';
    }
}

/**
 * Counts Set-Cookie headers in an axios response.
 *
 * @param {unknown} setCookieHeader Set-Cookie header value.
 * @returns {number} Number of Set-Cookie header entries.
 */
function countSetCookieHeaders(setCookieHeader) {
    if (Array.isArray(setCookieHeader)) return setCookieHeader.length;
    if (typeof setCookieHeader === 'string' && setCookieHeader.length > 0) return 1;
    return 0;
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
    // The flags object might contain the 'enable' property (which is handled by the caller)
    // or the 'fields' object.
    const fields = flags.fields || flags;
    return Object.values(fields).some((v) => v === true);
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
    const fields = flags.fields || flags;

    if (fields.date === true) {
        const { utc, local } = formatTimestampUtcAndLocal(envelope?.timestamp);
        lines.push({ key: 'DATE (UTC)', value: utc });
        lines.push({ key: 'DATE (LOCAL)', value: local });
    }

    if (fields.eventId === true)
        lines.push({ key: 'EVENT ID', value: safeMetadataValue(envelope?.eventId) });
    if (fields.correlationId === true)
        lines.push({ key: 'CORRELATION ID', value: safeMetadataValue(envelope?.correlationId) });
    if (fields.selectionTxnId === true)
        lines.push({
            key: 'SELECTION TXN ID',
            value: safeMetadataValue(envelope?.payload?.event?.selectionTxnId),
        });

    if (fields.userId === true) {
        lines.push({ key: 'USER ID', value: safeMetadataValue(auditCtx?.user) });
    }

    if (fields.appId === true)
        lines.push({ key: 'APP ID', value: safeMetadataValue(auditCtx?.appId) });
    if (fields.appName === true)
        lines.push({ key: 'APP NAME', value: safeMetadataValue(auditCtx?.appName) });
    if (fields.sheetName === true)
        lines.push({ key: 'SHEET NAME', value: safeMetadataValue(auditCtx?.sheetName) });

    if (fields.viewingDuration === true) {
        const durationMs = auditCtx?.viewingDuration;
        const durationSec = typeof durationMs === 'number' ? (durationMs / 1000).toFixed(2) : 'n/a';
        lines.push({ key: 'VIEWING DURATION (s)', value: durationSec });
    }

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
 * Crops a PNG image buffer to the specified rectangle.
 *
 * The Printing Service may render more rows than are visible on screen
 * (e.g. pivot tables with a virtualScroll buffer larger than the viewport).
 * The extension sends a `crop` object with the exact visible dimensions so
 * we can trim the PNG to match what the user actually sees.
 *
 * @param {Buffer} buffer - The original PNG image buffer.
 * @param {{ top: number, left: number, width: number, height: number, scrollTop?: number, scrollAreaOffsetY?: number }} crop - Crop rectangle with optional scroll metadata.
 * @param {Logger} [logger] Logger.
 * @returns {Buffer} Cropped PNG buffer, or the original buffer if cropping is unnecessary.
 */
function cropPngBuffer(buffer, crop, logger) {
    let src = PNG.sync.read(buffer);

    if (logger) {
        // Scan from the bottom to find the last row that contains non-white pixels.
        // This tells us where the actual table content ends in the rendered image.
        let contentBottomY = 0;
        for (let y = src.height - 1; y >= 0; y--) {
            let hasContent = false;
            for (let x = 0; x < src.width; x++) {
                const idx = (y * src.width + x) * 4;
                const r = src.data[idx];
                const g = src.data[idx + 1];
                const b = src.data[idx + 2];
                // Non-white pixel (with some tolerance for anti-aliasing)
                if (r < 250 || g < 250 || b < 250) {
                    hasContent = true;
                    break;
                }
            }
            if (hasContent) {
                contentBottomY = y + 1;
                break;
            }
        }

        logger.debug(
            `AUDIT API: cropPngBuffer source=${src.width}x${src.height} crop={top:${crop.top},left:${crop.left},w:${crop.width},h:${crop.height},scrollTop:${crop.scrollTop || 0},scrollAreaOffsetY:${crop.scrollAreaOffsetY || 0},renderingOverflow:${crop.renderingOverflow || 0}} needsCrop=${src.width > crop.width || src.height > crop.height} contentBottomY=${contentBottomY}`
        );

        // Save debug copy of the pre-crop image
        try {
            const debugDir = path.join(process.cwd(), 'audit-events', 'debug');
            if (!fsSync.existsSync(debugDir)) {
                fsSync.mkdirSync(debugDir, { recursive: true });
            }
            const debugFile = path.join(debugDir, `pre-crop-${src.width}x${src.height}.png`);
            fsSync.writeFileSync(debugFile, buffer);
            logger.verbose(`AUDIT API: Saved pre-crop debug image to ${debugFile}`);
        } catch (dbgErr) {
            logger.debug(`AUDIT API: Failed to save debug image: ${dbgErr.message}`);
        }
    }

    // SCROLL-AWARE COMPOSITE CROP:
    // When the extension reports scrollTop > 0, the Printing API rendered from
    // scrollTop=0 (no scroll applied). The rendered image contains:
    //   y=0 .. scrollAreaOffsetY           → title area (outside scroll container)
    //   y=scrollAreaOffsetY .. +scrollTop   → scroll content that was scrolled past
    //   y=scrollAreaOffsetY+scrollTop .. end → visible scroll content (headers + data)
    //
    // We composite: keep the title region, skip scrolled-past content, keep the
    // rest. Then the standard overflow crop trims the bottom edge.
    const scrollTop = crop.scrollTop || 0;
    const scrollAreaOffsetY = crop.scrollAreaOffsetY || 0;
    if (scrollTop > 0 && scrollAreaOffsetY >= 0 && scrollAreaOffsetY + scrollTop < src.height) {
        const skipEnd = scrollAreaOffsetY + scrollTop;
        const regionAHeight = scrollAreaOffsetY; // title
        const regionBHeight = src.height - skipEnd; // visible scroll content
        const compositeHeight = regionAHeight + regionBHeight;

        if (logger) {
            logger.info(
                `AUDIT API: Scroll composite: titleRegion=0..${regionAHeight} skip=${scrollAreaOffsetY}..${skipEnd} visibleRegion=${skipEnd}..${src.height} compositeHeight=${compositeHeight}`
            );
        }

        const composite = new PNG({ width: src.width, height: compositeHeight });

        // Copy Region A: title area (y=0 to y=scrollAreaOffsetY)
        for (let y = 0; y < regionAHeight; y++) {
            const srcOff = y * src.width * 4;
            const dstOff = y * src.width * 4;
            src.data.copy(composite.data, dstOff, srcOff, srcOff + src.width * 4);
        }

        // Copy Region B: visible scroll content (y=skipEnd to y=src.height)
        for (let y = 0; y < regionBHeight; y++) {
            const srcOff = (skipEnd + y) * src.width * 4;
            const dstOff = (regionAHeight + y) * src.width * 4;
            src.data.copy(composite.data, dstOff, srcOff, srcOff + src.width * 4);
        }

        // Use composite as the new source for the standard crop step
        src = composite;
        buffer = PNG.sync.write(composite);

        if (logger) {
            // Save debug composite image
            try {
                const debugDir = path.join(process.cwd(), 'audit-events', 'debug');
                const debugFile = path.join(
                    debugDir,
                    `composite-${src.width}x${compositeHeight}.png`
                );
                fsSync.writeFileSync(debugFile, buffer);
                logger.info(`AUDIT API: Saved composite debug image to ${debugFile}`);
            } catch (dbgErr) {
                logger.debug(`AUDIT API: Failed to save composite debug image: ${dbgErr.message}`);
            }
        }
    }

    // OVERFLOW-AWARE COMPOSITE CROP:
    // The Printing API renders ALL data rows fully — it never clips rows. When a
    // partial row is visible on screen (e.g. 18px of a 21px row), the inflate+crop
    // approach inflates the rendering height so rows render at their correct pixel
    // height, then expects cropping to clip the last row. However, the Printing API
    // places table content with a margin at the bottom, so a simple bottom crop
    // removes margin pixels, not data row pixels. The last row stays fully visible.
    //
    // Fix: detect the table's bottom grid line (a uniform horizontal line marking
    // the end of data rows), then composite the image by removing `overflow` pixels
    // from just above that line. This clips into the last data row, producing the
    // correct partial-row effect. The margin below is preserved.
    const renderingOverflow = crop.renderingOverflow || 0;
    if (renderingOverflow > 0) {
        // Find the table grid bottom line: scan upward from near the bottom,
        // looking for a uniform horizontal line in the grid-line brightness
        // range (160-245). We skip the outer border columns (first/last ~50px)
        // because the table frame border has a different color than interior
        // grid lines, which would break a uniformity check starting at x=0.
        let gridLineY = -1;
        const margin = Math.min(50, Math.floor(src.width * 0.05));
        const startY = Math.max(0, src.height - 5);
        for (let y = startY; y >= Math.floor(src.height / 2); y--) {
            // Use a reference pixel from the interior, not the border frame
            const refX = Math.floor(src.width / 4);
            const firstIdx = (y * src.width + refX) * 4;
            const refR = src.data[firstIdx];
            const refG = src.data[firstIdx + 1];
            const refB = src.data[firstIdx + 2];
            const brightness = (refR + refG + refB) / 3;
            // Grid-line brightness range includes darker separators (e.g. native
            // table header separator at ~166) through light row separators (~242).
            if (brightness < 160 || brightness > 245) continue;

            let isUniform = true;
            let checked = 0;
            for (let x = margin; x < src.width - margin; x += 10) {
                const idx = (y * src.width + x) * 4;
                const r = src.data[idx];
                const g = src.data[idx + 1];
                const b = src.data[idx + 2];
                if (Math.abs(r - refR) > 5 || Math.abs(g - refG) > 5 || Math.abs(b - refB) > 5) {
                    isUniform = false;
                    break;
                }
                checked++;
            }
            if (isUniform && checked > 10) {
                // Verify this is a real data grid line, not part of a margin band
                // or the outer border frame. Two checks:
                // 1. The row above must be brighter (data cell background ≈ 255)
                //    than the gridline (≈ 204-242). A margin/border row has similar
                //    brightness to the candidate, so brightness difference is small.
                // 2. Fall back: if the row above is also uniform but has clearly
                //    different brightness (>10 apart), accept the candidate —
                //    it's a gridline adjacent to a white data row.
                if (y > 0) {
                    const aboveRefX = Math.floor(src.width / 4);
                    const aboveRefIdx = ((y - 1) * src.width + aboveRefX) * 4;
                    const aboveRefR = src.data[aboveRefIdx];
                    const aboveRefG = src.data[aboveRefIdx + 1];
                    const aboveRefB = src.data[aboveRefIdx + 2];
                    const aboveBrightness = (aboveRefR + aboveRefG + aboveRefB) / 3;

                    // Check if row above is non-uniform (has varied cell content)
                    let aboveUniform = true;
                    for (let x = margin; x < src.width - margin; x += 10) {
                        const idx = ((y - 1) * src.width + x) * 4;
                        if (Math.abs(src.data[idx] - aboveRefR) > 5) {
                            aboveUniform = false;
                            break;
                        }
                    }

                    if (!aboveUniform) {
                        // Row above has varied content → real gridline
                        gridLineY = y;
                        break;
                    }
                    // Row above is uniform — accept if it's significantly brighter
                    // (white data cell ≈255 vs gridline ≈242 → diff ≈13).
                    // Reject if brightness difference is small (adjacent border band).
                    if (aboveBrightness - brightness > 8) {
                        gridLineY = y;
                        break;
                    }
                }
            }
        }

        if (gridLineY >= 0 && gridLineY - renderingOverflow >= 0) {
            // Composite: keep content up to (gridLine - overflow), skip overflow,
            // keep grid line and everything below (margin area).
            const keepAbove = gridLineY - renderingOverflow; // rows 0..keepAbove-1
            const keepBelow = src.height - gridLineY; // gridLine row + margin below
            const overflowCompositeHeight = keepAbove + keepBelow;

            if (logger) {
                logger.info(
                    `AUDIT API: Overflow composite: gridLineY=${gridLineY} overflow=${renderingOverflow} keepAbove=${keepAbove} keepBelow=${keepBelow} compositeHeight=${overflowCompositeHeight}`
                );
            }

            const ovComp = new PNG({ width: src.width, height: overflowCompositeHeight });

            // Copy region above the overflow strip (data with partial last row)
            for (let y = 0; y < keepAbove; y++) {
                const srcOff = y * src.width * 4;
                const dstOff = y * src.width * 4;
                src.data.copy(ovComp.data, dstOff, srcOff, srcOff + src.width * 4);
            }

            // Copy grid line + margin (from gridLineY to end)
            for (let y = 0; y < keepBelow; y++) {
                const srcOff = (gridLineY + y) * src.width * 4;
                const dstOff = (keepAbove + y) * src.width * 4;
                src.data.copy(ovComp.data, dstOff, srcOff, srcOff + src.width * 4);
            }

            src = ovComp;
            buffer = PNG.sync.write(ovComp);

            if (logger) {
                try {
                    const debugDir = path.join(process.cwd(), 'audit-events', 'debug');
                    if (!fsSync.existsSync(debugDir)) {
                        fsSync.mkdirSync(debugDir, { recursive: true });
                    }
                    const debugFile = path.join(
                        debugDir,
                        `overflow-composite-${src.width}x${overflowCompositeHeight}.png`
                    );
                    fsSync.writeFileSync(debugFile, buffer);
                    logger.info(`AUDIT API: Saved overflow composite debug image to ${debugFile}`);
                } catch (dbgErr) {
                    logger.debug(
                        `AUDIT API: Failed to save overflow composite debug image: ${dbgErr.message}`
                    );
                }
            }
        } else if (logger) {
            logger.info(
                `AUDIT API: Overflow composite skipped — grid line not found (gridLineY=${gridLineY}, overflow=${renderingOverflow})`
            );
        }
    }

    // Standard crop: trim to the target dimensions (handles overflow at bottom edge)
    if (src.width <= crop.width && src.height <= crop.height) {
        return buffer;
    }

    const cropW = Math.min(crop.width, src.width - crop.left);
    const cropH = Math.min(crop.height, src.height - crop.top);

    if (cropW <= 0 || cropH <= 0) {
        return buffer;
    }

    const dst = new PNG({ width: cropW, height: cropH });

    for (let y = 0; y < cropH; y++) {
        const srcOffset = ((crop.top + y) * src.width + crop.left) * 4;
        const dstOffset = y * cropW * 4;
        src.data.copy(dst.data, dstOffset, srcOffset, srcOffset + cropW * 4);
    }

    return PNG.sync.write(dst);
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
 * @returns {Promise<{ savedPaths: string[] } | null>} Saved file paths, or null if not saved.
 */
export async function downloadScreenshot(url, envelope, config, logger) {
    if (!config?.enable) return null;

    const selectionTxnId = envelope?.payload?.event?.selectionTxnId;

    // Validate the URL scheme to prevent Server-Side Request Forgery (SSRF).
    // Only http: and https: schemes are permitted; file://, ftp://, data:, etc. are rejected.
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            logger.warn(
                `AUDIT API: Screenshot download rejected — URL scheme '${parsedUrl.protocol}' is not allowed. Only http: and https: are permitted. selectionTxnId=${selectionTxnId}`
            );
            return null;
        }
    } catch {
        logger.warn(
            `AUDIT API: Screenshot download rejected — URL is not a valid absolute URL. selectionTxnId=${selectionTxnId}`
        );
        return null;
    }

    const targets = Array.isArray(config.storageTargets)
        ? config.storageTargets.filter((t) => t && t.enable === true)
        : [];

    if (targets.length === 0) {
        logger.warn(
            `AUDIT API: Screenshot download enabled, but no storageTargets are enabled. selectionTxnId=${selectionTxnId}`
        );
        return null;
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

    debugLog(
        logger,
        `AUDIT API: Screenshot download configured selectionTxnId=${selectionTxnId} authMode=${authMode} timeoutMs=${timeoutMs} maxAttempts=${maxAttempts} enabledTargets=${targets
            .map((target) => `${target.type}:${target.directory}`)
            .join(',')} urlSummary="${summarizeUrlForDebug(url)}" ${auditCtxStr}`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let downloadUrl = url;
        let httpsAgent;
        let sessionCookieHeader = null;

        try {
            debugLog(
                logger,
                `AUDIT API: Screenshot download attempt start attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} authMode=${authMode} urlSummary="${summarizeUrlForDebug(
                    url
                )}"`
            );

            if (authMode === 'qpsTicket') {
                const qps = config?.auth?.qps;
                if (!qps?.host || !qps?.port || !qps?.userDirectory || !qps?.userId) {
                    logger.warn(
                        `AUDIT API: Screenshot auth mode is qpsTicket, but QPS settings are missing. selectionTxnId=${selectionTxnId} ${auditCtxStr}`
                    );
                    return;
                }

                debugLog(
                    logger,
                    `AUDIT API: Screenshot download requesting QPS ticket attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} qpsHost=${qps.host} qpsPort=${qps.port}`
                );

                const ticket = await requestQpsTicket(qps, logger);
                downloadUrl = withQlikTicket(url, ticket);
                httpsAgent = createQlikMutualTlsAgent();

                debugLog(
                    logger,
                    `AUDIT API: Screenshot download received QPS ticket attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} ticketLength=${ticket.length} downloadUrlSummary="${summarizeUrlForDebug(
                        downloadUrl
                    )}"`
                );
            }

            debugLog(
                logger,
                `AUDIT API: Screenshot download HTTP GET attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} url=${redactQlikTicketInUrl(
                    downloadUrl
                )} httpsAgent=${httpsAgent ? 'mutualTls' : 'default'} timeoutMs=${timeoutMs}`
            );

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
            let buffer = Buffer.from(response.data);

            debugLog(
                logger,
                `AUDIT API: Screenshot download HTTP response attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} status=${response.status} contentType=${
                    contentType || 'n/a'
                } bytes=${buffer.length} setCookieCount=${countSetCookieHeaders(
                    response.headers?.['set-cookie']
                )} url=${redactQlikTicketInUrl(downloadUrl)}`
            );

            // Extract session cookie immediately using set-cookie-parser for reliability.
            // set-cookie-parser handles joined header strings and complex attributes.
            const cookies = setCookieParser.parse(response, { decodeValues: false });
            const sessionCookie = cookies.find((c) =>
                c.name.toLowerCase().startsWith('x-qlik-session-')
            );

            debugLog(
                logger,
                `AUDIT API: Screenshot download parsed cookies attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} cookieCount=${cookies.length} sessionCookieName=${
                    sessionCookie?.name || 'none'
                } sessionCookieVirtualProxy=${
                    sessionCookie
                        ? extractVirtualProxyFromSessionCookieName(sessionCookie.name) ||
                          '(default)'
                        : 'n/a'
                } sessionCookieValueLength=${sessionCookie?.value?.length || 0}`
            );

            if (sessionCookie) {
                sessionCookieHeader = {
                    name: sessionCookie.name,
                    value: sessionCookie.value,
                };
            }

            // Non-2xx
            if (response.status < 200 || response.status >= 300) {
                const retryable = isRetryableHttpStatus(response.status);

                if (retryable && attempt < maxAttempts) {
                    const delayMs = baseDelayMs * 2 ** (attempt - 1);
                    logger.info(
                        `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms httpStatus=${
                            response.status
                        } selectionTxnId=${selectionTxnId} url=${redactQlikTicketInUrl(
                            downloadUrl
                        )} (original=${url}) ${auditCtxStr}`
                    );
                    await sleep(delayMs);
                    continue;
                }

                const level = retryable ? 'error' : 'warn';
                logger[level](
                    `AUDIT API: Screenshot download failed httpStatus=${response.status} url=${redactQlikTicketInUrl(
                        downloadUrl
                    )} (original=${url}) attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} ${auditCtxStr}`
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
                        `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms selectionTxnId=${selectionTxnId} nonImageContentType='${
                            contentType
                        }' url=${redactQlikTicketInUrl(downloadUrl)} (original=${url}) ${auditCtxStr}`
                    );
                    await sleep(delayMs);
                    continue;
                }

                logger.error(
                    `AUDIT API: Screenshot download returned non-image content-type='${contentType}'. url=${redactQlikTicketInUrl(
                        downloadUrl
                    )} (original=${url}) attempt=${attempt}/${maxAttempts} selectionTxnId=${selectionTxnId} preview='${preview}' ${auditCtxStr}`
                );
                return;
            }

            // Crop PNG to visible area if the extension provided crop dimensions.
            // The Printing Service may render more content than what's visible
            // on screen (e.g. pivot tables with buffered rows beyond the viewport).
            const ext = extensionFromContentType(contentType) || extensionFromUrl(url);
            const crop = envelope?.payload?.event?.crop;
            const evtWidth = envelope?.payload?.event?.width;
            const evtHeight = envelope?.payload?.event?.height;
            logger.debug(
                `AUDIT API: Pre-crop check: ext=${ext} eventDims=${evtWidth}x${evtHeight} crop=${JSON.stringify(crop)} selectionTxnId=${selectionTxnId}`
            );
            if (
                ext === 'png' &&
                crop &&
                typeof crop.width === 'number' &&
                typeof crop.height === 'number' &&
                crop.width > 0 &&
                crop.height > 0
            ) {
                try {
                    const beforeLen = buffer.length;
                    buffer = cropPngBuffer(buffer, crop, logger);
                    logger.debug(
                        `AUDIT API: Cropped screenshot PNG to ${crop.width}x${crop.height} (top=${crop.top ?? 0}, left=${crop.left ?? 0}). selectionTxnId=${selectionTxnId} beforeBytes=${beforeLen} afterBytes=${buffer.length}`
                    );
                } catch (cropErr) {
                    logger.warn(
                        `AUDIT API: Failed to crop screenshot PNG. selectionTxnId=${selectionTxnId} error=${formatAxiosError(cropErr)} ${auditCtxStr}`
                    );
                    // Continue with the uncropped buffer
                }
            }

            const filename = buildScreenshotFilename(envelope, url, contentType);

            const metadataFlags = config?.addInImageMetadata;
            const shouldAddMetadata =
                ext === 'png' &&
                metadataFlags?.enable === true &&
                hasAnyEnabledMetadataFlag(metadataFlags);
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
                        `AUDIT API: Failed to add metadata header to screenshot PNG. selectionTxnId=${selectionTxnId}error=${formatAxiosError(
                            err
                        )} ${auditCtxStr}`
                    );
                    metadataBuffer = undefined;
                }
            }

            /** @type {string[]} */
            const savedPaths = [];

            for (const target of targets) {
                if (target.type !== 'flat') continue;

                const directoryPath = path.resolve(target.directory);
                await fs.mkdir(directoryPath, { recursive: true });

                const filePath = path.join(directoryPath, filename);
                await fs.writeFile(filePath, buffer);

                savedPaths.push(filePath);

                logger.info(
                    `AUDIT API: Saved screenshot, selectionTxnId=${selectionTxnId} file=${filePath}`
                );

                if (metadataBuffer && metadataBuffer.length > 0) {
                    const metadataFilename = buildMetadataFilename(filename);
                    const metadataFilePath = path.join(directoryPath, metadataFilename);
                    await fs.writeFile(metadataFilePath, metadataBuffer);
                    savedPaths.push(metadataFilePath);
                    logger.info(
                        `AUDIT API: Saved screenshot metadata, selectionTxnId=${selectionTxnId} file=${metadataFilePath}`
                    );
                }
            }

            return savedPaths.length > 0 ? { savedPaths } : null;
        } catch (err) {
            if (attempt < maxAttempts) {
                const delayMs = baseDelayMs * 2 ** (attempt - 1);
                logger.info(
                    `AUDIT API: Screenshot download retrying attempt=${attempt + 1}/${maxAttempts} in ${delayMs}ms selectionTxnId=${selectionTxnId} error=${formatAxiosError(
                        err
                    )} url=${redactQlikTicketInUrl(downloadUrl)} (original=${url}) ${auditCtxStr}`
                );
                await sleep(delayMs);
                continue;
            }

            logger.error(
                `AUDIT API: Screenshot download failed after ${maxAttempts} attempts. selectionTxnId=${selectionTxnId} error=${formatAxiosError(
                    err
                )} url=${redactQlikTicketInUrl(downloadUrl)} (original=${url}) ${auditCtxStr}`
            );
            return null;
        } finally {
            if (sessionCookieHeader && authMode === 'qpsTicket') {
                debugLog(
                    logger,
                    `AUDIT API: Screenshot download cleanup deleting QPS session selectionTxnId=${selectionTxnId} cookieName=${sessionCookieHeader.name} virtualProxy=${
                        extractVirtualProxyFromSessionCookieName(sessionCookieHeader.name) ||
                        '(default)'
                    } sessionIdLength=${sessionCookieHeader.value.length}`
                );
                await deleteQpsSession(
                    config.auth.qps,
                    sessionCookieHeader.name,
                    sessionCookieHeader.value,
                    logger
                );
            } else if (authMode === 'qpsTicket') {
                debugLog(
                    logger,
                    `AUDIT API: Screenshot download cleanup skipped QPS session delete selectionTxnId=${selectionTxnId} reason=no-session-cookie attempt=${attempt}/${maxAttempts}`
                );
            }
        }
    }

    return null;
}
