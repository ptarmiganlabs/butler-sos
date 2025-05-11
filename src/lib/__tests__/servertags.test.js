import { jest, describe, test, afterEach } from '@jest/globals';

// Import the module under test
const { getServerTags } = await import('../servertags.js');

describe('servertags', () => {
    // Create a mock logger
    const mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return correct tags for server without custom tags', () => {
        // Setup test data
        const server = {
            host: 'server1.example.com:4747',
            serverName: 'Test Server',
            serverDescription: 'This is a test server',
        };

        // Call the function being tested
        const result = getServerTags(mockLogger, server);

        // Expectations
        expect(result).toEqual({
            host: 'server1.example.com',
            server_name: 'Test Server',
            server_description: 'This is a test server',
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Complete list of tags for server Test Server')
        );
    });

    test('should include custom server tags when present', () => {
        // Setup test data
        const server = {
            host: 'server2.example.com:4747',
            serverName: 'Test Server 2',
            serverDescription: 'This is a test server with custom tags',
            serverTags: {
                environment: 'production',
                location: 'datacenter1',
                role: 'primary',
            },
        };

        // Call the function being tested
        const result = getServerTags(mockLogger, server);

        // Expectations
        expect(result).toEqual({
            host: 'server2.example.com',
            server_name: 'Test Server 2',
            server_description: 'This is a test server with custom tags',
            environment: 'production',
            location: 'datacenter1',
            role: 'primary',
        });

        // Verify each custom tag was logged
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Found server tag'));
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Complete list of tags for server Test Server 2')
        );
    });

    test('should handle null serverTags properly', () => {
        // Setup test data
        const server = {
            host: 'server3.example.com:4747',
            serverName: 'Test Server 3',
            serverDescription: 'This is a test server with null tags',
            serverTags: null,
        };

        // Call the function being tested
        const result = getServerTags(mockLogger, server);

        // Expectations
        expect(result).toEqual({
            host: 'server3.example.com',
            server_name: 'Test Server 3',
            server_description: 'This is a test server with null tags',
        });
    });

    test('should return empty array and log error when exception occurs', () => {
        // Setup test data with missing required properties
        const server = null;

        // Call the function being tested
        const result = getServerTags(mockLogger, server);

        // Expectations
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('SERVERTAGS:'));
    });
});
