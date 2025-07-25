import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock fastify-plugin
jest.unstable_mockModule('fastify-plugin', () => ({
    default: jest.fn((fn) => fn),
}));

describe('support plugin', () => {
    let mockFastify;
    let supportPlugin;
    let fp;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Import mocked modules
        fp = (await import('fastify-plugin')).default;

        // Mock fastify instance
        mockFastify = {
            decorate: jest.fn(),
        };

        // Import the support plugin
        supportPlugin = (await import('../support.js')).default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should register the plugin with fastify-plugin', () => {
        expect(fp).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should decorate fastify with someSupport function', async () => {
        // Execute the plugin function
        await supportPlugin(mockFastify, {});

        // Check that decorate was called with the correct arguments
        expect(mockFastify.decorate).toHaveBeenCalledWith('someSupport', expect.any(Function));
    });

    test('someSupport function should return "hugs"', async () => {
        // Execute the plugin function
        await supportPlugin(mockFastify, {});

        // Get the function that was decorated
        const decorateCall = mockFastify.decorate.mock.calls[0];
        const someSupportFn = decorateCall[1];

        // Test the function
        const result = someSupportFn();
        expect(result).toBe('hugs');
    });
});
