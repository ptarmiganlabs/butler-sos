import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
};

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v2/utils', () => {
    let applyInfluxTags, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const utils = await import('../v2/utils.js');
        applyInfluxTags = utils.applyInfluxTags;

        mockPoint.tag.mockReturnThis();
    });

    test('should apply single tag', () => {
        const tags = [{ name: 'env', value: 'prod' }];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledWith('env', 'prod');
        expect(result).toBe(mockPoint);
    });

    test('should apply multiple tags', () => {
        const tags = [
            { name: 'env', value: 'prod' },
            { name: 'region', value: 'us-east' },
            { name: 'cluster', value: 'main' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledTimes(3);
        expect(mockPoint.tag).toHaveBeenCalledWith('env', 'prod');
        expect(mockPoint.tag).toHaveBeenCalledWith('region', 'us-east');
        expect(mockPoint.tag).toHaveBeenCalledWith('cluster', 'main');
        expect(result).toBe(mockPoint);
    });

    test('should handle null tags', () => {
        const result = applyInfluxTags(mockPoint, null);

        expect(mockPoint.tag).not.toHaveBeenCalled();
        expect(result).toBe(mockPoint);
    });

    test('should handle undefined tags', () => {
        const result = applyInfluxTags(mockPoint, undefined);

        expect(mockPoint.tag).not.toHaveBeenCalled();
        expect(result).toBe(mockPoint);
    });

    test('should handle empty array', () => {
        const result = applyInfluxTags(mockPoint, []);

        expect(mockPoint.tag).not.toHaveBeenCalled();
        expect(result).toBe(mockPoint);
    });

    test('should skip tags with null values', () => {
        const tags = [
            { name: 'env', value: 'prod' },
            { name: 'region', value: null },
            { name: 'cluster', value: 'main' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledTimes(2);
        expect(mockPoint.tag).toHaveBeenCalledWith('env', 'prod');
        expect(mockPoint.tag).toHaveBeenCalledWith('cluster', 'main');
        expect(mockPoint.tag).not.toHaveBeenCalledWith('region', null);
        expect(result).toBe(mockPoint);
    });

    test('should skip tags with undefined values', () => {
        const tags = [
            { name: 'env', value: 'prod' },
            { name: 'region', value: undefined },
            { name: 'cluster', value: 'main' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledTimes(2);
        expect(mockPoint.tag).toHaveBeenCalledWith('env', 'prod');
        expect(mockPoint.tag).toHaveBeenCalledWith('cluster', 'main');
        expect(result).toBe(mockPoint);
    });

    test('should skip tags without name', () => {
        const tags = [
            { name: 'env', value: 'prod' },
            { value: 'no-name' },
            { name: 'cluster', value: 'main' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledTimes(2);
        expect(mockPoint.tag).toHaveBeenCalledWith('env', 'prod');
        expect(mockPoint.tag).toHaveBeenCalledWith('cluster', 'main');
        expect(result).toBe(mockPoint);
    });

    test('should convert non-string values to strings', () => {
        const tags = [
            { name: 'count', value: 123 },
            { name: 'enabled', value: true },
            { name: 'ratio', value: 3.14 },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledWith('count', '123');
        expect(mockPoint.tag).toHaveBeenCalledWith('enabled', 'true');
        expect(mockPoint.tag).toHaveBeenCalledWith('ratio', '3.14');
        expect(result).toBe(mockPoint);
    });

    test('should handle empty string values', () => {
        const tags = [
            { name: 'env', value: '' },
            { name: 'region', value: 'us-east' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledTimes(2);
        expect(mockPoint.tag).toHaveBeenCalledWith('env', '');
        expect(mockPoint.tag).toHaveBeenCalledWith('region', 'us-east');
        expect(result).toBe(mockPoint);
    });

    test('should handle zero as value', () => {
        const tags = [{ name: 'count', value: 0 }];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledWith('count', '0');
        expect(result).toBe(mockPoint);
    });

    test('should handle false as value', () => {
        const tags = [{ name: 'enabled', value: false }];

        const result = applyInfluxTags(mockPoint, tags);

        expect(mockPoint.tag).toHaveBeenCalledWith('enabled', 'false');
        expect(result).toBe(mockPoint);
    });

    test('should handle non-array input', () => {
        const result = applyInfluxTags(mockPoint, 'not-an-array');

        expect(mockPoint.tag).not.toHaveBeenCalled();
        expect(result).toBe(mockPoint);
    });

    test('should handle object instead of array', () => {
        const result = applyInfluxTags(mockPoint, { name: 'env', value: 'prod' });

        expect(mockPoint.tag).not.toHaveBeenCalled();
        expect(result).toBe(mockPoint);
    });

    test('should support method chaining', () => {
        const tags = [
            { name: 'env', value: 'prod' },
            { name: 'region', value: 'us-east' },
        ];

        const result = applyInfluxTags(mockPoint, tags);

        // The function returns the point for chaining
        expect(result).toBe(mockPoint);
        expect(typeof result.tag).toBe('function');
    });
});
