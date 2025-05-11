import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            debug: jest.fn(),
            error: jest.fn(),
        },
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { getServerHeaders } = await import('../serverheaders.js');

describe('serverheaders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return empty object when server has no headers', () => {
        // Setup test data
        const server = {
            serverName: 'Test Server',
        };

        // Call the function being tested
        const result = getServerHeaders(server);

        // Expectations
        expect(result).toEqual({});
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Additional headers for server Test Server')
        );
    });

    test('should return correct headers for server with custom headers', () => {
        // Setup test data
        const server = {
            serverName: 'Test Server 2',
            headers: {
                'X-API-Key': 'test-api-key',
                'Content-Type': 'application/json',
                Authorization: 'Bearer token123',
            },
        };

        // Call the function being tested
        const result = getServerHeaders(server);

        // Expectations
        expect(result).toEqual({
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
        });

        // Verify debug logs
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Additional headers for server Test Server 2')
        );
    });

    test('should handle null headers properly', () => {
        // Setup test data
        const server = {
            serverName: 'Test Server 3',
            headers: null,
        };

        // Call the function being tested
        const result = getServerHeaders(server);

        // Expectations
        expect(result).toEqual({});
    });

    test('should return empty array and log error when exception occurs', () => {
        // Setup test data to cause an error
        const server = undefined;

        // Call the function being tested
        const result = getServerHeaders(server);

        // Expectations
        expect(result).toEqual([]);
        expect(globals.logger.error).toHaveBeenCalledWith(expect.stringContaining('SERVERTAGS:'));
    });
});
