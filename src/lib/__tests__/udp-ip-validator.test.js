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

const { isIPv4, parseAllowedSources, isIpAllowed } = await import('../udp-ip-validator.js');

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
        test('should return true when allowedIPs list is empty', () => {
            expect(isIpAllowed('192.168.1.1', [])).toBe(true);
        });

        test('should return true when allowedIPs is null', () => {
            expect(isIpAllowed('192.168.1.1', null)).toBe(true);
        });

        test('should return true when allowedIPs is undefined', () => {
            expect(isIpAllowed('192.168.1.1', undefined)).toBe(true);
        });

        test('should return true when IP is in the allowed list', () => {
            const allowedIPs = ['192.168.1.1', '10.0.0.5'];
            expect(isIpAllowed('192.168.1.1', allowedIPs)).toBe(true);
            expect(isIpAllowed('10.0.0.5', allowedIPs)).toBe(true);
        });

        test('should return false when IP is not in the allowed list', () => {
            const allowedIPs = ['192.168.1.1', '10.0.0.5'];
            expect(isIpAllowed('192.168.1.2', allowedIPs)).toBe(false);
            expect(isIpAllowed('172.16.0.1', allowedIPs)).toBe(false);
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
});
