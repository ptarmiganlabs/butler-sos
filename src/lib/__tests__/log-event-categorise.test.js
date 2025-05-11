import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock the globals module
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
        },
        config: {
            get: jest.fn(),
        },
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { categoriseLogEvent } = await import('../log-event-categorise.js');

describe('log-event-categorise', () => {
    beforeEach(() => {
        // Setup default config values for tests
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [
                    {
                        logLevel: ['ERROR', 'WARN'],
                        filter: [
                            { type: 'sw', value: 'Engine: Failed to load script' },
                            { type: 'so', value: 'out of memory' },
                        ],
                        category: [
                            { name: 'area', value: 'engine' },
                            { name: 'type', value: 'script-error' },
                        ],
                        action: 'categorise',
                    },
                    {
                        logLevel: ['ERROR'],
                        filter: [
                            { type: 'ew', value: 'failed to start' },
                            { type: 'so', value: 'connection refused' },
                        ],
                        category: [
                            { name: 'area', value: 'service' },
                            { name: 'type', value: 'startup-error' },
                        ],
                        action: 'categorise',
                    },
                    {
                        logLevel: ['DEBUG'],
                        filter: [{ type: 'so', value: 'debug message' }],
                        category: [{ name: 'area', value: 'debug' }],
                        action: 'drop',
                    },
                ];
            } else if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.enable') {
                return true;
            } else if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.category') {
                return [{ name: 'area', value: 'uncategorised' }];
            }
            return undefined;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should categorise log events matching start-with filter', () => {
        const result = categoriseLogEvent('ERROR', 'Engine: Failed to load script for app XYZ');

        expect(result).toEqual({
            category: [
                { name: 'area', value: 'engine' },
                { name: 'type', value: 'script-error' },
            ],
            actionTaken: 'categorised',
        });
    });

    test('should categorise log events matching ends-with filter', () => {
        const result = categoriseLogEvent('ERROR', 'Service failed to start');

        expect(result).toEqual({
            category: [
                { name: 'area', value: 'service' },
                { name: 'type', value: 'startup-error' },
            ],
            actionTaken: 'categorised',
        });
    });

    test('should categorise log events matching substring filter', () => {
        const result = categoriseLogEvent('ERROR', 'The process ran out of memory');

        expect(result).toEqual({
            category: [
                { name: 'area', value: 'engine' },
                { name: 'type', value: 'script-error' },
            ],
            actionTaken: 'categorised',
        });
    });

    test('should drop log events when action is drop', () => {
        const result = categoriseLogEvent('DEBUG', 'This is a debug message to be ignored');

        expect(result).toEqual({
            category: [],
            actionTaken: 'dropped',
        });
    });

    test('should apply default category when no rules match', () => {
        const result = categoriseLogEvent('INFO', 'This is an uncategorised message');

        expect(result).toEqual({
            category: [{ name: 'area', value: 'uncategorised' }],
            actionTaken: 'categorised',
        });
    });

    test('should remove duplicate categories', () => {
        // Mock a rule that would produce duplicate categories
        globals.config.get.mockImplementationOnce((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [
                    {
                        logLevel: ['ERROR'],
                        filter: [
                            { type: 'sw', value: 'Duplicate' },
                            { type: 'so', value: 'Duplicate' }, // Both filters match the same message
                        ],
                        category: [
                            { name: 'area', value: 'engine' },
                            { name: 'type', value: 'error' },
                        ],
                        action: 'categorise',
                    },
                ];
            }
            return undefined;
        });

        const result = categoriseLogEvent('ERROR', 'Duplicate error message');

        // Categories should only appear once even though both filters matched
        expect(result.category).toHaveLength(2);
    });

    test('should warn when filter type is not recognised', () => {
        // Mock a rule with invalid filter type
        globals.config.get.mockImplementationOnce((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [
                    {
                        logLevel: ['ERROR'],
                        filter: [{ type: 'invalid', value: 'test' }],
                        category: [{ name: 'area', value: 'error' }],
                        action: 'categorise',
                    },
                ];
            }
            return undefined;
        });

        categoriseLogEvent('ERROR', 'Test message');

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Filter type 'invalid' is not recognised")
        );
    });

    test('should handle errors and return null', () => {
        // Force an error by returning null from config.get
        globals.config.get.mockImplementationOnce(() => null);

        const result = categoriseLogEvent('ERROR', 'Test message');

        expect(result).toBeNull();
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error processing log event')
        );
    });
});
