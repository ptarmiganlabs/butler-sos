import { describe, test, expect } from '@jest/globals';

// error-categorizer.js has no external dependencies, so no mocking needed
const { getErrorCategory, getErrorMetadata } = await import('../error-categorizer.js');

describe('error-categorizer', () => {
    // ------------------------------------------------------------------ //
    // getErrorCategory
    // ------------------------------------------------------------------ //
    describe('getErrorCategory', () => {
        test('returns "unknown" when err is null', () => {
            expect(getErrorCategory(null)).toBe('unknown');
        });

        test('returns "unknown" when err is undefined', () => {
            expect(getErrorCategory(undefined)).toBe('unknown');
        });

        test('returns "unknown" for an unrecognised error', () => {
            expect(getErrorCategory(new Error('something went wrong'))).toBe('unknown');
        });

        // Timeout ------------------------------------------------------- //
        test('returns "timeout" for ETIMEDOUT code', () => {
            const err = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
            expect(getErrorCategory(err)).toBe('timeout');
        });

        test('returns "timeout" for ECONNABORTED code', () => {
            const err = Object.assign(new Error('aborted'), { code: 'ECONNABORTED' });
            expect(getErrorCategory(err)).toBe('timeout');
        });

        test('returns "timeout" when message includes "timeout"', () => {
            const err = new Error('request timeout exceeded');
            expect(getErrorCategory(err)).toBe('timeout');
        });

        test('returns "timeout" for RequestTimedOutError name', () => {
            const err = Object.assign(new Error(''), { name: 'RequestTimedOutError' });
            expect(getErrorCategory(err)).toBe('timeout');
        });

        // Connection errors --------------------------------------------- //
        test('returns "connection_refused" for ECONNREFUSED', () => {
            const err = Object.assign(new Error(), { code: 'ECONNREFUSED' });
            expect(getErrorCategory(err)).toBe('connection_refused');
        });

        test('returns "host_not_found" for ENOTFOUND', () => {
            const err = Object.assign(new Error(), { code: 'ENOTFOUND' });
            expect(getErrorCategory(err)).toBe('host_not_found');
        });

        test('returns "connection_reset" for ECONNRESET', () => {
            const err = Object.assign(new Error(), { code: 'ECONNRESET' });
            expect(getErrorCategory(err)).toBe('connection_reset');
        });

        // HTTP status --------------------------------------------------- //
        test('returns "auth_error" for HTTP 401', () => {
            const err = Object.assign(new Error(), { response: { status: 401 } });
            expect(getErrorCategory(err)).toBe('auth_error');
        });

        test('returns "auth_error" for HTTP 403', () => {
            const err = Object.assign(new Error(), { response: { status: 403 } });
            expect(getErrorCategory(err)).toBe('auth_error');
        });

        test('returns "not_found" for HTTP 404', () => {
            const err = Object.assign(new Error(), { response: { status: 404 } });
            expect(getErrorCategory(err)).toBe('not_found');
        });

        test('returns "rate_limited" for HTTP 429', () => {
            const err = Object.assign(new Error(), { response: { status: 429 } });
            expect(getErrorCategory(err)).toBe('rate_limited');
        });

        test('returns "http_5xx" for HTTP 500', () => {
            const err = Object.assign(new Error(), { response: { status: 500 } });
            expect(getErrorCategory(err)).toBe('http_5xx');
        });

        test('returns "http_5xx" for HTTP 503', () => {
            const err = Object.assign(new Error(), { response: { status: 503 } });
            expect(getErrorCategory(err)).toBe('http_5xx');
        });

        test('returns "http_4xx" for HTTP 400', () => {
            const err = Object.assign(new Error(), { response: { status: 400 } });
            expect(getErrorCategory(err)).toBe('http_4xx');
        });

        test('returns "http_4xx" for HTTP 422', () => {
            const err = Object.assign(new Error(), { response: { status: 422 } });
            expect(getErrorCategory(err)).toBe('http_4xx');
        });

        // Certificate errors -------------------------------------------- //
        test('returns "certificate_error" when message contains "cert"', () => {
            const err = new Error('invalid cert chain');
            expect(getErrorCategory(err)).toBe('certificate_error');
        });

        test('returns "certificate_error" when message contains "TLS"', () => {
            const err = new Error('TLS handshake failed');
            expect(getErrorCategory(err)).toBe('certificate_error');
        });

        test('returns "certificate_error" when message contains "SSL"', () => {
            const err = new Error('SSL SYSCALL error');
            expect(getErrorCategory(err)).toBe('certificate_error');
        });

        // MQTT & New Relic ----------------------------------------------- //
        test('returns "mqtt_error" when message contains "mqtt"', () => {
            const err = new Error('mqtt broker refused connection');
            expect(getErrorCategory(err)).toBe('mqtt_error');
        });

        test('returns "new_relic_error" when message contains "new relic"', () => {
            const err = new Error('new relic API returned 403');
            expect(getErrorCategory(err)).toBe('new_relic_error');
        });

        // Precedence: code-based checks win over message-based ----------- //
        test('code-based timeout check takes precedence over message check', () => {
            // ETIMEDOUT code — should match before reaching message checks
            const err = Object.assign(new Error('cert TLS error'), { code: 'ETIMEDOUT' });
            expect(getErrorCategory(err)).toBe('timeout');
        });
    });

    // ------------------------------------------------------------------ //
    // getErrorMetadata
    // ------------------------------------------------------------------ //
    describe('getErrorMetadata', () => {
        test('returns base fields for a plain Error', () => {
            const err = new Error('generic');
            const meta = getErrorMetadata(err);

            expect(meta).toMatchObject({
                error_category: 'unknown',
                error_code: '',
                http_status: null,
            });
            // No optional fields when there is no config/cause
            expect(meta.request_url).toBeUndefined();
            expect(meta.request_timeout_ms).toBeUndefined();
            expect(meta.remote_address).toBeUndefined();
            expect(meta.remote_port).toBeUndefined();
            expect(meta.syscall).toBeUndefined();
        });

        test('includes error_code when err.code is set', () => {
            const err = Object.assign(new Error(), { code: 'ECONNREFUSED' });
            const meta = getErrorMetadata(err);
            expect(meta.error_code).toBe('ECONNREFUSED');
            expect(meta.error_category).toBe('connection_refused');
        });

        test('includes http_status when err.response.status is set', () => {
            const err = Object.assign(new Error(), { response: { status: 500 } });
            const meta = getErrorMetadata(err);
            expect(meta.http_status).toBe(500);
            expect(meta.error_category).toBe('http_5xx');
        });

        // Axios config extras ------------------------------------------- //
        test('strips query string from request URL', () => {
            const err = Object.assign(new Error(), {
                code: 'ETIMEDOUT',
                config: {
                    url: 'https://sense.example.com:4747/engine/healthcheck?key=secret',
                    timeout: 5000,
                },
            });
            const meta = getErrorMetadata(err);
            expect(meta.request_url).toBe('https://sense.example.com:4747/engine/healthcheck');
            expect(meta.request_timeout_ms).toBe(5000);
        });

        test('falls back to split("?") for unparseable URLs', () => {
            const err = Object.assign(new Error(), {
                config: {
                    url: 'not-a-valid-url?query=1',
                },
            });
            const meta = getErrorMetadata(err);
            expect(meta.request_url).toBe('not-a-valid-url');
        });

        test('omits request_timeout_ms when config.timeout is absent', () => {
            const err = Object.assign(new Error(), {
                config: { url: 'https://example.com/path' },
            });
            const meta = getErrorMetadata(err);
            expect(meta.request_timeout_ms).toBeUndefined();
            expect(meta.request_url).toBe('https://example.com/path');
        });

        test('omits request_url when config.url is absent', () => {
            const err = Object.assign(new Error(), {
                config: { timeout: 3000 },
            });
            const meta = getErrorMetadata(err);
            expect(meta.request_timeout_ms).toBe(3000);
            expect(meta.request_url).toBeUndefined();
        });

        // Network-level cause ------------------------------------------- //
        test('includes remote_address, remote_port, and syscall from err.cause', () => {
            const cause = { address: '192.168.1.1', port: 4747, syscall: 'connect' };
            const err = Object.assign(new Error(), { cause });
            const meta = getErrorMetadata(err);
            expect(meta.remote_address).toBe('192.168.1.1');
            expect(meta.remote_port).toBe(4747);
            expect(meta.syscall).toBe('connect');
        });

        test('omits cause fields when cause is absent', () => {
            const err = new Error('no cause');
            const meta = getErrorMetadata(err);
            expect(meta.remote_address).toBeUndefined();
            expect(meta.remote_port).toBeUndefined();
            expect(meta.syscall).toBeUndefined();
        });

        test('omits individual cause fields that are absent', () => {
            // Only address present, no port or syscall
            const err = Object.assign(new Error(), { cause: { address: '10.0.0.1' } });
            const meta = getErrorMetadata(err);
            expect(meta.remote_address).toBe('10.0.0.1');
            expect(meta.remote_port).toBeUndefined();
            expect(meta.syscall).toBeUndefined();
        });

        test('handles remote_port of 0 (falsy but valid port)', () => {
            const err = Object.assign(new Error(), { cause: { address: '127.0.0.1', port: 0 } });
            const meta = getErrorMetadata(err);
            expect(meta.remote_port).toBe(0);
        });

        // Full Axios-style error ---------------------------------------- //
        test('full Axios ECONNREFUSED error produces all expected fields', () => {
            const err = Object.assign(new Error('connect ECONNREFUSED'), {
                code: 'ECONNREFUSED',
                config: {
                    url: 'https://sense.example.com:4243/qps/session?xrfkey=abc123',
                    timeout: 5000,
                },
                cause: {
                    address: '192.168.100.110',
                    port: 4243,
                    syscall: 'connect',
                },
            });
            const meta = getErrorMetadata(err);
            expect(meta.error_category).toBe('connection_refused');
            expect(meta.error_code).toBe('ECONNREFUSED');
            expect(meta.http_status).toBe(null);
            expect(meta.request_url).toBe('https://sense.example.com:4243/qps/session');
            expect(meta.request_timeout_ms).toBe(5000);
            expect(meta.remote_address).toBe('192.168.100.110');
            expect(meta.remote_port).toBe(4243);
            expect(meta.syscall).toBe('connect');
        });
    });
});
