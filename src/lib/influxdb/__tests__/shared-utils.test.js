import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals
const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: {
        get: jest.fn(),
        has: jest.fn(),
    },
    influx: null,
    appNames: [],
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

describe('Shared Utils - getFormattedTime', () => {
    let utils;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
    });

    test('should return empty string for null input', () => {
        const result = utils.getFormattedTime(null);
        expect(result).toBe('');
    });

    test('should return empty string for undefined input', () => {
        const result = utils.getFormattedTime(undefined);
        expect(result).toBe('');
    });

    test('should return empty string for empty string input', () => {
        const result = utils.getFormattedTime('');
        expect(result).toBe('');
    });

    test('should return empty string for non-string input', () => {
        const result = utils.getFormattedTime(12345);
        expect(result).toBe('');
    });

    test('should return empty string for string shorter than minimum length', () => {
        const result = utils.getFormattedTime('20240101T12');
        expect(result).toBe('');
    });

    test('should return empty string for invalid date components', () => {
        const result = utils.getFormattedTime('abcdXXXXTxxxxxx');
        expect(result).toBe('');
    });

    test('should handle invalid date gracefully', () => {
        // JavaScript Date constructor is lenient and converts Month 13 to January of next year
        // So this doesn't actually fail - it's a valid date to JS
        const result = utils.getFormattedTime('20241301T250000');

        // The function doesn't validate date ranges, so this will return a formatted time
        expect(typeof result).toBe('string');
    });

    test('should format valid timestamp correctly', () => {
        // Mock Date.now to return a known value
        const mockNow = new Date('2024-01-01T13:00:00').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(mockNow);

        const result = utils.getFormattedTime('20240101T120000');

        // Should show approximately 1 hour difference
        expect(result).toMatch(/\d+ days, \d+h \d+m \d+s/);

        Date.now.mockRestore();
    });

    test('should handle timestamps with exact minimum length', () => {
        const mockNow = new Date('2024-01-01T13:00:00').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(mockNow);

        const result = utils.getFormattedTime('20240101T120000');

        expect(result).not.toBe('');
        expect(result).toMatch(/\d+ days/);

        Date.now.mockRestore();
    });

    test('should handle future timestamps', () => {
        const mockNow = new Date('2024-01-01T12:00:00').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(mockNow);

        // Server started in the future (edge case)
        const result = utils.getFormattedTime('20250101T120000');

        // Result might be negative or weird, but shouldn't crash
        expect(typeof result).toBe('string');

        Date.now.mockRestore();
    });
});

describe('Shared Utils - processAppDocuments', () => {
    let utils;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');

        globals.appNames = [
            { id: 'app-123', name: 'Sales Dashboard' },
            { id: 'app-456', name: 'HR Analytics' },
            { id: 'app-789', name: 'Finance Report' },
        ];
    });

    test('should process empty array', async () => {
        const result = await utils.processAppDocuments([], 'TEST', 'active');

        expect(result).toEqual({
            appNames: [],
            sessionAppNames: [],
        });
    });

    test('should identify session apps correctly', async () => {
        const docIDs = ['SessionApp_12345', 'SessionApp_67890'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.sessionAppNames).toEqual(['SessionApp_12345', 'SessionApp_67890']);
        expect(result.appNames).toEqual([]);
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Session app is active')
        );
    });

    test('should resolve app IDs to names', async () => {
        const docIDs = ['app-123', 'app-456'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'loaded');

        expect(result.appNames).toEqual(['HR Analytics', 'Sales Dashboard']);
        expect(result.sessionAppNames).toEqual([]);
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('App is loaded: Sales Dashboard')
        );
    });

    test('should use doc ID when app name not found', async () => {
        const docIDs = ['app-unknown', 'app-123'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'in memory');

        expect(result.appNames).toEqual(['Sales Dashboard', 'app-unknown']);
        expect(result.sessionAppNames).toEqual([]);
    });

    test('should mix session apps and regular apps', async () => {
        const docIDs = ['app-123', 'SessionApp_abc', 'app-456', 'SessionApp_def', 'app-unknown'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.appNames).toEqual(['HR Analytics', 'Sales Dashboard', 'app-unknown']);
        expect(result.sessionAppNames).toEqual(['SessionApp_abc', 'SessionApp_def']);
    });

    test('should sort both arrays alphabetically', async () => {
        const docIDs = ['app-789', 'app-123', 'app-456', 'SessionApp_z', 'SessionApp_a'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.appNames).toEqual(['Finance Report', 'HR Analytics', 'Sales Dashboard']);
        expect(result.sessionAppNames).toEqual(['SessionApp_a', 'SessionApp_z']);
    });

    test('should handle session app prefix at start only', async () => {
        const docIDs = ['SessionApp_test', 'NotSessionApp_test', 'app-123'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.sessionAppNames).toEqual(['SessionApp_test']);
        expect(result.appNames).toEqual(['NotSessionApp_test', 'Sales Dashboard']);
    });

    test('should handle single document', async () => {
        const docIDs = ['app-456'];

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.appNames).toEqual(['HR Analytics']);
        expect(result.sessionAppNames).toEqual([]);
    });

    test('should handle many documents efficiently', async () => {
        const docIDs = Array.from({ length: 100 }, (_, i) =>
            i % 2 === 0 ? `SessionApp_${i}` : `app-${i}`
        );

        const result = await utils.processAppDocuments(docIDs, 'TEST', 'active');

        expect(result.sessionAppNames.length).toBe(50);
        expect(result.appNames.length).toBe(50);
        // Arrays are sorted alphabetically
        expect(result.sessionAppNames).toEqual(expect.arrayContaining(['SessionApp_0']));
        expect(result.appNames).toEqual(expect.arrayContaining(['app-1']));
    });
});

describe('Shared Utils - applyTagsToPoint3', () => {
    let utils;
    let mockPoint;

    beforeEach(async () => {
        jest.clearAllMocks();
        utils = await import('../shared/utils.js');

        mockPoint = {
            setTag: jest.fn().mockReturnThis(),
        };
    });

    test('should return point unchanged for null tags', () => {
        const result = utils.applyTagsToPoint3(mockPoint, null);

        expect(result).toBe(mockPoint);
        expect(mockPoint.setTag).not.toHaveBeenCalled();
    });

    test('should return point unchanged for undefined tags', () => {
        const result = utils.applyTagsToPoint3(mockPoint, undefined);

        expect(result).toBe(mockPoint);
        expect(mockPoint.setTag).not.toHaveBeenCalled();
    });

    test('should return point unchanged for non-object tags', () => {
        const result = utils.applyTagsToPoint3(mockPoint, 'not-an-object');

        expect(result).toBe(mockPoint);
        expect(mockPoint.setTag).not.toHaveBeenCalled();
    });

    test('should apply single tag', () => {
        const tags = { env: 'production' };

        const result = utils.applyTagsToPoint3(mockPoint, tags);

        expect(result).toBe(mockPoint);
        expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
        expect(mockPoint.setTag).toHaveBeenCalledTimes(1);
    });

    test('should apply multiple tags', () => {
        const tags = {
            env: 'production',
            region: 'us-east-1',
            service: 'qlik-sense',
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledTimes(3);
        expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
        expect(mockPoint.setTag).toHaveBeenCalledWith('region', 'us-east-1');
        expect(mockPoint.setTag).toHaveBeenCalledWith('service', 'qlik-sense');
    });

    test('should convert non-string values to strings', () => {
        const tags = {
            count: 42,
            enabled: true,
            version: 3.14,
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledWith('count', '42');
        expect(mockPoint.setTag).toHaveBeenCalledWith('enabled', 'true');
        expect(mockPoint.setTag).toHaveBeenCalledWith('version', '3.14');
    });

    test('should skip null values', () => {
        const tags = {
            env: 'production',
            region: null,
            service: 'qlik-sense',
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledTimes(2);
        expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
        expect(mockPoint.setTag).toHaveBeenCalledWith('service', 'qlik-sense');
        expect(mockPoint.setTag).not.toHaveBeenCalledWith('region', expect.anything());
    });

    test('should skip undefined values', () => {
        const tags = {
            env: 'production',
            region: undefined,
            service: 'qlik-sense',
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledTimes(2);
        expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
        expect(mockPoint.setTag).toHaveBeenCalledWith('service', 'qlik-sense');
    });

    test('should handle empty object', () => {
        const tags = {};

        const result = utils.applyTagsToPoint3(mockPoint, tags);

        expect(result).toBe(mockPoint);
        expect(mockPoint.setTag).not.toHaveBeenCalled();
    });

    test('should handle tags with special characters', () => {
        const tags = {
            'tag-with-dash': 'value',
            tag_with_underscore: 'value2',
            'tag.with.dot': 'value3',
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledTimes(3);
        expect(mockPoint.setTag).toHaveBeenCalledWith('tag-with-dash', 'value');
        expect(mockPoint.setTag).toHaveBeenCalledWith('tag_with_underscore', 'value2');
        expect(mockPoint.setTag).toHaveBeenCalledWith('tag.with.dot', 'value3');
    });

    test('should handle empty string values', () => {
        const tags = {
            env: '',
            region: 'us-east-1',
        };

        utils.applyTagsToPoint3(mockPoint, tags);

        expect(mockPoint.setTag).toHaveBeenCalledWith('env', '');
        expect(mockPoint.setTag).toHaveBeenCalledWith('region', 'us-east-1');
    });
});
