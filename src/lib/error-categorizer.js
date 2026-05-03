/**
 * Error categorization utilities for Butler SOS.
 *
 * This module provides functions to categorize errors based on their properties,
 * enabling better error tracking and alerting in InfluxDB.
 */

/**
 * Categorizes an error based on its properties.
 *
 * @param {Error} err - The error object
 * @returns {string} Error category: 'timeout', 'connection_refused', 'auth_error', etc.
 */
export function getErrorCategory(err) {
    if (!err) return 'unknown';

    // Timeout errors
    if (
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('timeout') ||
        err.name === 'RequestTimedOutError'
    ) {
        return 'timeout';
    }

    // Connection errors
    if (err.code === 'ECONNREFUSED') return 'connection_refused';
    if (err.code === 'ENOTFOUND') return 'host_not_found';
    if (err.code === 'ECONNRESET') return 'connection_reset';

    // HTTP errors
    const status = err.response?.status;
    if (status) {
        if (status === 401 || status === 403) return 'auth_error';
        if (status === 404) return 'not_found';
        if (status === 429) return 'rate_limited';
        if (status >= 500) return 'http_5xx';
        if (status >= 400) return 'http_4xx';
    }

    // Certificate errors
    if (
        err.message?.includes('cert') ||
        err.message?.includes('TLS') ||
        err.message?.includes('SSL')
    ) {
        return 'certificate_error';
    }

    // MQTT specific
    if (err.message?.includes('mqtt')) return 'mqtt_error';

    // New Relic specific
    if (err.message?.includes('new relic')) return 'new_relic_error';

    return 'unknown';
}

/**
 * Extracts error metadata from an error object.
 *
 * @param {Error} err - The error object
 * @returns {object} Metadata with error_category, error_code, http_status
 */
export function getErrorMetadata(err) {
    return {
        error_category: getErrorCategory(err),
        error_code: err?.code || '',
        http_status: err?.response?.status || null,
    };
}
