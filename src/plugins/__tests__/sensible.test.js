import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock fastify-plugin
jest.unstable_mockModule('fastify-plugin', () => ({
    default: jest.fn((fn) => fn),
}));

// Mock @fastify/sensible
jest.unstable_mockModule('@fastify/sensible', () => ({
    default: jest.fn(),
}));

describe('sensible plugin', () => {
    let mockFastify;
    let sensiblePlugin;
    let fp;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Import mocked modules
        fp = (await import('fastify-plugin')).default;

        // Mock fastify instance
        mockFastify = {
            register: jest.fn().mockResolvedValue(undefined),
        };

        // Import the sensible plugin
        sensiblePlugin = (await import('../sensible.js')).default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should register the plugin with fastify-plugin', () => {
        expect(fp).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should register @fastify/sensible with correct options', async () => {
        // Execute the plugin function
        await sensiblePlugin(mockFastify, {});

        // Check that register was called with the correct arguments
        expect(mockFastify.register).toHaveBeenCalledWith(
            expect.anything(), // Dynamic import result
            { errorHandler: false }
        );
    });
});
