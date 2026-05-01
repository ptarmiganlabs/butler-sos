import { describe, test, expect, jest } from '@jest/globals';
import path from 'path';

const mockConfig = {
    has: jest.fn(),
    get: jest.fn(),
};

const globalsPath = path.resolve('src/globals.js');

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        config: mockConfig,
    },
}));

const { readString, readNumber, readBoolean, asObject, getAuditDestinationEnabled } = await import(
    '../helpers.js'
);

describe('shared/helpers – readString', () => {
    test('returns the value for a non-empty string', () => {
        expect(readString('hello')).toBe('hello');
    });

    test('returns undefined for an empty string', () => {
        expect(readString('')).toBeUndefined();
    });

    test('returns undefined for a number', () => {
        expect(readString(42)).toBeUndefined();
    });

    test('returns undefined for null', () => {
        expect(readString(null)).toBeUndefined();
    });

    test('returns undefined for undefined', () => {
        expect(readString(undefined)).toBeUndefined();
    });

    test('returns undefined for a boolean', () => {
        expect(readString(true)).toBeUndefined();
    });
});

describe('shared/helpers – readNumber', () => {
    test('returns the value for a finite number', () => {
        expect(readNumber(42)).toBe(42);
    });

    test('returns the value for a negative number', () => {
        expect(readNumber(-3.14)).toBe(-3.14);
    });

    test('returns undefined for Infinity', () => {
        expect(readNumber(Infinity)).toBeUndefined();
    });

    test('returns undefined for -Infinity', () => {
        expect(readNumber(-Infinity)).toBeUndefined();
    });

    test('returns undefined for NaN', () => {
        expect(readNumber(NaN)).toBeUndefined();
    });

    test('returns undefined for a string', () => {
        expect(readNumber('42')).toBeUndefined();
    });

    test('returns undefined for null', () => {
        expect(readNumber(null)).toBeUndefined();
    });

    test('returns undefined for undefined', () => {
        expect(readNumber(undefined)).toBeUndefined();
    });
});

describe('shared/helpers – readBoolean', () => {
    test('returns true for boolean true', () => {
        expect(readBoolean(true)).toBe(true);
    });

    test('returns false for boolean false', () => {
        expect(readBoolean(false)).toBe(false);
    });

    test('returns undefined for a string', () => {
        expect(readBoolean('true')).toBeUndefined();
    });

    test('returns undefined for a number', () => {
        expect(readBoolean(1)).toBeUndefined();
    });

    test('returns undefined for null', () => {
        expect(readBoolean(null)).toBeUndefined();
    });

    test('returns undefined for undefined', () => {
        expect(readBoolean(undefined)).toBeUndefined();
    });
});

describe('shared/helpers – asObject', () => {
    test('returns a plain object', () => {
        const obj = { a: 1 };
        expect(asObject(obj)).toBe(obj);
    });

    test('returns an array (arrays are objects)', () => {
        const arr = [1, 2, 3];
        expect(asObject(arr)).toBe(arr);
    });

    test('returns undefined for null', () => {
        expect(asObject(null)).toBeUndefined();
    });

    test('returns undefined for a string', () => {
        expect(asObject('hello')).toBeUndefined();
    });

    test('returns undefined for a number', () => {
        expect(asObject(42)).toBeUndefined();
    });

    test('returns undefined for undefined', () => {
        expect(asObject(undefined)).toBeUndefined();
    });
});

describe('shared/helpers – getAuditDestinationEnabled', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns true when config key exists and value is true', () => {
        mockConfig.has.mockReturnValue(true);
        mockConfig.get.mockReturnValue(true);
        expect(getAuditDestinationEnabled()).toBe(true);
    });

    test('returns false when config key exists but value is false', () => {
        mockConfig.has.mockReturnValue(true);
        mockConfig.get.mockReturnValue(false);
        expect(getAuditDestinationEnabled()).toBe(false);
    });

    test('returns false when config key does not exist', () => {
        mockConfig.has.mockReturnValue(false);
        expect(getAuditDestinationEnabled()).toBe(false);
    });

    test('returns false when config value is a non-boolean truthy value', () => {
        mockConfig.has.mockReturnValue(true);
        mockConfig.get.mockReturnValue(1);
        expect(getAuditDestinationEnabled()).toBe(false);
    });
});
