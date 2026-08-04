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
            // Required by getConfigArray(): node-config exposes has() alongside get(), and
            // returns true for any configured key — including one whose value is null.
            has: jest.fn(() => true),
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
        // Force a genuine error. This previously used `() => null` and relied on
        // `for (const rule of null)` throwing — i.e. on the very crash that issue #1450 is
        // about. Now that a null rules list is read as an empty list, that no longer throws,
        // so the error path needs a real failure to exercise it.
        globals.config.get.mockImplementationOnce(() => {
            throw new Error('config read failed');
        });

        const result = categoriseLogEvent('ERROR', 'Test message');

        expect(result).toBeNull();
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error processing log event')
        );
    });

    test('treats a null rules list as no rules instead of throwing', () => {
        // The shipped production_template.yaml leaves categorise.rules with every entry
        // commented out, which YAML parses as null. Regression guard for #1450.
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') return null;
            if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.enable') return false;
            return null;
        });

        const result = categoriseLogEvent('ERROR', 'Test message');

        expect(result).toEqual({ category: [], actionTaken: 'categorised' });
        expect(globals.logger.error).not.toHaveBeenCalled();
    });

    test('treats a null default-category list as no categories instead of throwing', () => {
        // Same shape one level down: ruleDefault.category is nullable and also ships
        // commented out. Spreading it (`...null`) throws just as iterating does.
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') return [];
            if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.enable') return true;
            if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.category') return null;
            return null;
        });

        const result = categoriseLogEvent('ERROR', 'Test message');

        expect(result).toEqual({ category: [], actionTaken: 'categorised' });
        expect(globals.logger.error).not.toHaveBeenCalled();
    });
});
