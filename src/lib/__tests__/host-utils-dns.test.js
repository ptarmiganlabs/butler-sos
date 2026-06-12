import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Create the mock function OUTSIDE the factory so every import site shares the same reference.
const mockLookup = jest.fn();

jest.unstable_mockModule('node:dns/promises', () => ({
    default: { lookup: mockLookup },
    lookup: mockLookup,
}));

const { resolvesToIpAddress } = await import('../host-utils.js');

describe('host-utils – hostname DNS resolution', () => {
    beforeEach(() => {
        mockLookup.mockReset();
    });

    test('returns true when a hostname resolves to an IPv4 address', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(resolvesToIpAddress('example.com')).resolves.toBe(true);
        expect(mockLookup).toHaveBeenCalledWith('example.com', { family: 4 });
    });

    test('returns false when dns.lookup rejects', async () => {
        mockLookup.mockRejectedValue(new Error('ENOTFOUND'));

        await expect(resolvesToIpAddress('nonexistent.invalid')).resolves.toBe(false);
    });
});
