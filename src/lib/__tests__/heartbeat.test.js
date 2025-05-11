import { jest, describe, test, afterEach, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('@breejs/later', () => ({
    default: {
        parse: {
            text: jest.fn().mockReturnValue({}),
        },
        setInterval: jest.fn((callback) => {
            // Don't immediately invoke callback to avoid the error
            // Just return the timer object
            return { clear: jest.fn() };
        }),
    },
}));

jest.unstable_mockModule('axios', () => ({
    default: {
        get: jest.fn(),
    },
}));

// Import mocked modules
const later = (await import('@breejs/later')).default;
const axios = (await import('axios')).default;

// Import the module to test
const { setupHeartbeatTimer } = await import('../heartbeat.js');

describe('heartbeat', () => {
    // Create mock config and logger
    const mockConfig = {
        get: jest.fn(),
    };

    const mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
    };

    beforeEach(() => {
        // Setup mock config values
        mockConfig.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.heartbeat.remoteURL') {
                return 'https://example.com/heartbeat';
            } else if (path === 'Butler-SOS.heartbeat.frequency') {
                return 'every 5 minutes';
            }
            return undefined;
        });

        // Setup axios mock response
        axios.get.mockResolvedValue({ status: 200 });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should setup heartbeat timer and make initial call', async () => {
        // Call the function under test
        setupHeartbeatTimer(mockConfig, mockLogger);

        // Wait for promises to resolve
        await new Promise(process.nextTick);

        // Verify later.parse.text was called with the correct frequency
        expect(later.parse.text).toHaveBeenCalledWith('every 5 minutes');

        // Verify later.setInterval was called
        expect(later.setInterval).toHaveBeenCalled();

        // Verify the initial ping was made
        expect(axios.get).toHaveBeenCalledWith('https://example.com/heartbeat');

        // Verify debug logs were made
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('HEARTBEAT: Setting up heartbeat to remote')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('HEARTBEAT: Sent heartbeat to')
        );
    });

    test('should log error when axios request fails', async () => {
        // Setup axios to reject
        const error = new Error('Network error');
        axios.get.mockRejectedValueOnce(error);

        // Call the function under test
        setupHeartbeatTimer(mockConfig, mockLogger);

        // Wait for promises to resolve
        await new Promise(process.nextTick);

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('HEARTBEAT: Error sending heartbeat')
        );
    });

    test('should log error when setup fails', () => {
        // Force a setup error
        const mockError = new Error('Configuration error');
        mockConfig.get.mockImplementation(() => {
            throw mockError;
        });

        // Call the function under test
        setupHeartbeatTimer(mockConfig, mockLogger);

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('HEARTBEAT: Error'));
    });
});
