import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../../../../globals.js');

// Mock globals
jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: {
            debug: jest.fn(),
        },
    },
}));

const { processAppSpecificFilters, processAllAppsFilters } = await import('../qix-perf-filters.js');

describe('qix-perf-filters', () => {
    const eventData = {
        eventAppId: 'app1',
        eventAppName: 'AppName1',
        eventObjectId: 'obj1',
        eventObjectType: 'type1',
        eventMethod: 'method1',
    };

    describe('processAppSpecificFilters', () => {
        test('should return false if disabled', () => {
            expect(processAppSpecificFilters(eventData, { enable: false })).toBe(false);
        });

        test('should return true if app matches and all filters are true', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true },
                        appObject: { allAppObjects: true },
                        method: { allMethods: true },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(true);
        });

        test('should return false if app does not match', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'other' }],
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(false);
        });

        test('should handle objectType exclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true, allObjectTypesExclude: ['type1'] },
                        appObject: { allAppObjects: true },
                        method: { allMethods: true },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(false);
        });

        test('should handle objectType inclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: false, someObjectTypesInclude: ['type1'] },
                        appObject: { allAppObjects: true },
                        method: { allMethods: true },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(true);
        });

        test('should handle appObject exclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true },
                        appObject: {
                            allAppObjects: true,
                            allAppObjectsExclude: [{ objectId: 'obj1' }],
                        },
                        method: { allMethods: true },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(false);
        });

        test('should handle appObject inclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true },
                        appObject: {
                            allAppObjects: false,
                            someAppObjectsInclude: [{ objectId: 'obj1' }],
                        },
                        method: { allMethods: true },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(true);
        });

        test('should handle method exclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true },
                        appObject: { allAppObjects: true },
                        method: { allMethods: true, allMethodsExclude: ['method1'] },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(false);
        });

        test('should handle method inclusion', () => {
            const config = {
                enable: true,
                app: [
                    {
                        include: [{ appId: 'app1' }],
                        objectType: { allObjectTypes: true },
                        appObject: { allAppObjects: true },
                        method: { allMethods: false, someMethodsInclude: ['method1'] },
                    },
                ],
            };
            expect(processAppSpecificFilters(eventData, config)).toBe(true);
        });
    });

    describe('processAllAppsFilters', () => {
        test('should return false if disabled', () => {
            expect(processAllAppsFilters(eventData, { enable: false })).toBe(false);
        });

        test('should return true if all filters are true', () => {
            const config = {
                enable: true,
                appExclude: [],
                objectType: { allObjectTypes: true },
                method: { allMethods: true },
            };
            expect(processAllAppsFilters(eventData, config)).toBe(true);
        });

        test('should return false if app is excluded', () => {
            const config = {
                enable: true,
                appExclude: [{ appId: 'app1' }],
                objectType: { allObjectTypes: true },
                method: { allMethods: true },
            };
            expect(processAllAppsFilters(eventData, config)).toBe(false);
        });

        test('should handle objectType exclusion', () => {
            const config = {
                enable: true,
                appExclude: [],
                objectType: { allObjectTypes: true, allObjectTypesExclude: ['type1'] },
                method: { allMethods: true },
            };
            expect(processAllAppsFilters(eventData, config)).toBe(false);
        });

        test('should handle method exclusion', () => {
            const config = {
                enable: true,
                appExclude: [],
                objectType: { allObjectTypes: true },
                method: { allMethods: true, allMethodsExclude: ['method1'] },
            };
            expect(processAllAppsFilters(eventData, config)).toBe(false);
        });
    });
});
