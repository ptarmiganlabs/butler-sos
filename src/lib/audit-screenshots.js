import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} ScreenshotStorageTarget
 * @property {boolean} enable
 * @property {'flat'} type
 * @property {string} directory
 */

/**
 * @typedef {object} ScreenshotDownloadConfig
 * @property {boolean} enable
 * @property {number} downloadTimeoutMs
 * @property {ScreenshotStorageTarget[] | null} storageTargets
 */

/**
 * Sanitizes a string so it is safe to use as part of a filename.
 *
 * - Non-string or empty values are mapped to the literal string `none`.
 * - Unsafe characters are replaced with `_`.
 * - Output is capped to 128 characters.
 *
 * @param {unknown} value - The value to sanitize.
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
 * @param {string | null | undefined} timestamp - ISO-8601 timestamp.
 * @returns {string} A UTC timestamp formatted as `YYYYMMDDThhmmss.mmmZ`.
 */
function formatTimestampForFilename(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(date.getTime())) return 'invalid_timestamp';

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
 * Maps a HTTP Content-Type value to a preferred image file extension.
 *
 * Only a small allow-list is supported; unsupported types return `null`.
 *
 * @param {string | null | undefined} contentType - Content-Type header value.
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
 * Attempts to infer an image file extension from the URL path.
 *
 * Only a small allow-list is supported; unsupported/unknown extensions return `null`.
 * `jpeg` is normalized to `jpg`.
 *
 * @param {string} url - Screenshot URL.
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
 * Builds a unique filename for a screenshot.
 *
 * Required uniqueness properties:
 * - timestamp + eventId + correlationId
 *
 * @param {{ timestamp?: string, eventId?: string, correlationId?: string }} envelope
 * @param {string} url
 * @param {string|null} contentType
 * @returns {string}
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
 * @param {string} url
 * @param {{ timestamp?: string, eventId?: string, correlationId?: string }} envelope
 * @param {ScreenshotDownloadConfig} config
 * @param {import('../globals.js').default['logger']} logger
 * @returns {Promise<void>}
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.downloadTimeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
        });

        if (!response.ok) {
            logger.warn(`AUDIT API: Screenshot download failed HTTP ${response.status} url=${url}`);
            return;
        }

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = buildScreenshotFilename(envelope, url, contentType);

        for (const target of targets) {
            if (target.type !== 'flat') continue;

            const directoryPath = path.resolve(target.directory);
            await fs.mkdir(directoryPath, { recursive: true });

            const filePath = path.join(directoryPath, filename);
            await fs.writeFile(filePath, buffer);

            logger.info(`AUDIT API: Saved screenshot file=${filePath}`);
        }
    } catch (err) {
        logger.error(`AUDIT API: Screenshot download error: ${err && err.name ? err.name : err}`);
    } finally {
        clearTimeout(timeout);
    }
}
