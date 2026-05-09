import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dns module before importing the module under test
const mockResolve4 = jest.fn();
jest.unstable_mockModule('dns', () => ({
    default: {
        resolve4: mockResolve4,
    },
    resolve4: mockResolve4,
}));

// Mock util.promisify so it returns our mock directly
jest.unstable_mockModule('util', () => ({
    promisify: jest.fn().mockImplementation(() => mockResolve4),
}));

const { isIPv4, parseAllowedSources, isIpAllowed, createRejectThrottle } =
    await import('../udp-ip-validator.js');

describe('udp-ip-validator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -------------------------------------------------------
    describe('isIPv4', () => {
        test('should return true for valid IPv4 addresses', () => {
            expect(isIPv4('192.168.1.1')).toBe(true);
            expect(isIPv4('10.0.0.1')).toBe(true);
            expect(isIPv4('0.0.0.0')).toBe(true);
            expect(isIPv4('255.255.255.255')).toBe(true);
        });

        test('should return false for invalid IPv4 addresses', () => {
            expect(isIPv4('256.0.0.1')).toBe(false);
            expect(isIPv4('192.168.1')).toBe(false);
            expect(isIPv4('192.168.1.1.1')).toBe(false);
            expect(isIPv4('abc.def.ghi.jkl')).toBe(false);
            expect(isIPv4('')).toBe(false);
            expect(isIPv4('192.168.1.-1')).toBe(false);
        });

        test('should return false for hostnames', () => {
            expect(isIPv4('localhost')).toBe(false);
            expect(isIPv4('sense-server-01.domain.com')).toBe(false);
        });
    });

    // -------------------------------------------------------
    describe('isIpAllowed', () => {
        test('should return true when validationEnabled is false (default)', () => {
            // Validation disabled — always allow regardless of list
            expect(isIpAllowed('192.168.1.1', [])).toBe(true);
            expect(isIpAllowed('192.168.1.1', null)).toBe(true);
            expect(isIpAllowed('192.168.1.1', undefined)).toBe(true);
            expect(isIpAllowed('192.168.1.1', ['10.0.0.1'])).toBe(true);
        });

        test('should return false when validationEnabled is true and allowedIPs is empty', () => {
            expect(isIpAllowed('192.168.1.1', [], true)).toBe(false);
        });

        test('should return false when validationEnabled is true and allowedIPs is null', () => {
            expect(isIpAllowed('192.168.1.1', null, true)).toBe(false);
        });

        test('should return false when validationEnabled is true and allowedIPs is undefined', () => {
            expect(isIpAllowed('192.168.1.1', undefined, true)).toBe(false);
        });

        test('should return true when validationEnabled is true and IP is in the allowed list', () => {
            const allowedIPs = ['192.168.1.1', '10.0.0.5'];
            expect(isIpAllowed('192.168.1.1', allowedIPs, true)).toBe(true);
            expect(isIpAllowed('10.0.0.5', allowedIPs, true)).toBe(true);
        });

        test('should return false when validationEnabled is true and IP is not in the allowed list', () => {
            const allowedIPs = ['192.168.1.1', '10.0.0.5'];
            expect(isIpAllowed('192.168.1.2', allowedIPs, true)).toBe(false);
            expect(isIpAllowed('172.16.0.1', allowedIPs, true)).toBe(false);
        });
    });

    // -------------------------------------------------------
    describe('parseAllowedSources', () => {
        test('should parse literal IPv4 addresses without DNS lookup', async () => {
            const sources = ['192.168.1.1', '10.0.0.5'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toEqual(['192.168.1.1', '10.0.0.5']);
            expect(errors).toHaveLength(0);
            expect(mockResolve4).not.toHaveBeenCalled();
        });

        test('should resolve hostnames via DNS', async () => {
            mockResolve4.mockResolvedValueOnce(['10.11.12.13']);

            const sources = ['sense-server-01.domain.com'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toEqual(['10.11.12.13']);
            expect(errors).toHaveLength(0);
            expect(mockResolve4).toHaveBeenCalledWith('sense-server-01.domain.com');
        });

        test('should resolve hostnames to multiple IPs', async () => {
            mockResolve4.mockResolvedValueOnce(['10.11.12.13', '10.11.12.14']);

            const sources = ['multi-ip-host.domain.com'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toEqual(['10.11.12.13', '10.11.12.14']);
            expect(errors).toHaveLength(0);
        });

        test('should report an error for unresolvable hostnames', async () => {
            mockResolve4.mockResolvedValueOnce([]);

            const sources = ['nonexistent.invalid.host'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('nonexistent.invalid.host');
        });

        test('should report an error when DNS resolution throws', async () => {
            mockResolve4.mockRejectedValueOnce(new Error('DNS lookup failed'));

            const sources = ['bad.host'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('bad.host');
        });

        test('should handle a mix of IPs and hostnames', async () => {
            mockResolve4.mockResolvedValueOnce(['172.16.0.10']);

            const sources = ['192.168.1.100', 'hostname.example.com'];
            const { allowedIPs, errors } = await parseAllowedSources(sources);

            expect(allowedIPs).toEqual(['192.168.1.100', '172.16.0.10']);
            expect(errors).toHaveLength(0);
        });

        test('should return empty arrays for empty sources', async () => {
            const { allowedIPs, errors } = await parseAllowedSources([]);

            expect(allowedIPs).toHaveLength(0);
            expect(errors).toHaveLength(0);
        });
    });

    // -------------------------------------------------------
    describe('createRejectThrottle', () => {
        test('should log warn on first rejection from a new source', () => {
            const throttle = createRejectThrottle(60_000);
            const logger = { warn: jest.fn(), debug: jest.fn() };

            throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');

            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Rejected message from unauthorized source 1.2.3.4:1234')
            );
            expect(logger.debug).not.toHaveBeenCalled();
        });

        test('should log debug for repeated rejections within the interval', () => {
            const throttle = createRejectThrottle(60_000);
            const logger = { warn: jest.fn(), debug: jest.fn() };

            throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');
            throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');
            throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');

            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledTimes(2);
        });

        test('should log warn again after the interval expires', () => {
            const throttle = createRejectThrottle(1); // 1 ms interval for testing
            const logger = { warn: jest.fn(), debug: jest.fn() };

            throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');

            // Wait longer than 1 ms so the interval has elapsed
            return new Promise((resolve) => {
                setTimeout(() => {
                    throttle.logRejection('1.2.3.4', 1234, logger, '[TEST]:');
                    expect(logger.warn).toHaveBeenCalledTimes(2);
                    expect(logger.debug).not.toHaveBeenCalled();
                    resolve(undefined);
                }, 10);
            });
        });

        test('should throttle each source IP independently', () => {
            const throttle = createRejectThrottle(60_000);
            const logger = { warn: jest.fn(), debug: jest.fn() };

            throttle.logRejection('1.2.3.4', 100, logger, '[TEST]:');
            throttle.logRejection('5.6.7.8', 200, logger, '[TEST]:');
            throttle.logRejection('1.2.3.4', 100, logger, '[TEST]:'); // throttled
            throttle.logRejection('5.6.7.8', 200, logger, '[TEST]:'); // throttled

            expect(logger.warn).toHaveBeenCalledTimes(2);
            expect(logger.debug).toHaveBeenCalledTimes(2);
        });

        test('should prune stale entries from the state map', () => {
            const throttle = createRejectThrottle(1); // 1 ms interval for testing
            const logger = { warn: jest.fn(), debug: jest.fn() };

            // First warn from ip A — populates the map
            throttle.logRejection('10.0.0.1', 100, logger, '[TEST]:');

            // Wait long enough for the entry to age out, then warn from ip B
            return new Promise((resolve) => {
                setTimeout(() => {
                    // ip B warn triggers pruning of the stale ip A entry
                    throttle.logRejection('10.0.0.2', 200, logger, '[TEST]:');
                    // ip A should now be gone from the map, so next call warns again
                    throttle.logRejection('10.0.0.1', 100, logger, '[TEST]:');

                    expect(logger.warn).toHaveBeenCalledTimes(3);
                    expect(logger.debug).not.toHaveBeenCalled();
                    resolve(undefined);
                }, 10);
            });
        });
    });
});
