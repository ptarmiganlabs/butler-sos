import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the InfluxDB client
jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn().mockImplementation(() => ({
        tag: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        stringField: jest.fn().mockReturnThis(),
        uintField: jest.fn().mockReturnThis(),
        booleanField: jest.fn().mockReturnThis(), // <-- add this line
        timestamp: jest.fn().mockReturnThis(),
    })),
}));

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
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
        influxDB: {
            writeApi: {
                writePoint: jest.fn(),
                flush: jest.fn().mockResolvedValue(),
            },
        },
        appNames: [],
    },
}));

describe('post-to-influxdb', () => {
    let influxdb;
    let globals;
    let Point;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get mocked modules
        const influxdbClient = await import('@influxdata/influxdb-client');
        Point = influxdbClient.Point;
        globals = (await import('../../globals.js')).default;

        // Mock globals.influx for InfluxDB v1 tests
        globals.influx = { writePoints: jest.fn() };

        // Import the module under test
        influxdb = await import('../post-to-influxdb.js');
    });

    describe('storeEventCountInfluxDB', () => {
        test('should not store events if no log events exist', async () => {
            // Setup
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue([]),
                getUserEvents: jest.fn().mockResolvedValue([]),
            };

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('EVENT COUNT INFLUXDB: No events to store in InfluxDB')
            );
            expect(globals.influxDB.writeApi.writePoint).not.toHaveBeenCalled();
            expect(globals.influxDB.writeApi.flush).not.toHaveBeenCalled();
        });

        test('should store log events to InfluxDB (InfluxDB v1)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName') {
                    return 'events_log';
                }
                return undefined;
            });
            const mockLogEvents = [
                {
                    source: 'test-source',
                    host: 'test-host',
                    subsystem: 'test-subsystem',
                    counter: 5,
                },
            ];
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue(mockLogEvents),
                getUserEvents: jest.fn().mockResolvedValue([]),
            };

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.influx.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
                )
            );
        });

        test('should store log events to InfluxDB (InfluxDB v2)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName') {
                    return 'events_log';
                }
                if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'test-org';
                if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'test-bucket';
                return undefined;
            });
            const mockLogEvents = [
                {
                    source: 'test-source',
                    host: 'test-host',
                    subsystem: 'test-subsystem',
                    counter: 5,
                },
            ];
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue(mockLogEvents),
                getUserEvents: jest.fn().mockResolvedValue([]),
            };
            // Mock v2 writeApi
            globals.influx.getWriteApi = jest.fn().mockReturnValue({
                writePoints: jest.fn(),
            });

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.influx.getWriteApi).toHaveBeenCalled();
            // The writeApi mock's writePoints should be called
            const writeApi = globals.influx.getWriteApi.mock.results[0].value;
            expect(writeApi.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
                )
            );
        });

        test('should store user events to InfluxDB (InfluxDB v1)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName') {
                    return 'events_user';
                }
                return undefined;
            });
            const mockUserEvents = [
                {
                    source: 'test-source',
                    host: 'test-host',
                    subsystem: 'test-subsystem',
                    counter: 3,
                },
            ];
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue([]),
                getUserEvents: jest.fn().mockResolvedValue(mockUserEvents),
            };

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.influx.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
                )
            );
        });

        test('should store user events to InfluxDB (InfluxDB v2)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName') {
                    return 'events_user';
                }
                if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'test-org';
                if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'test-bucket';
                return undefined;
            });
            const mockUserEvents = [
                {
                    source: 'test-source',
                    host: 'test-host',
                    subsystem: 'test-subsystem',
                    counter: 3,
                },
            ];
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue([]),
                getUserEvents: jest.fn().mockResolvedValue(mockUserEvents),
            };
            // Mock v2 writeApi
            globals.influx.getWriteApi = jest.fn().mockReturnValue({
                writePoints: jest.fn(),
            });

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.influx.getWriteApi).toHaveBeenCalled();
            // The writeApi mock's writePoints should be called
            const writeApi = globals.influx.getWriteApi.mock.results[0].value;
            expect(writeApi.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
                )
            );
        });

        test('should handle errors gracefully (InfluxDB v1)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                return undefined;
            });
            // Instead of rejecting, resolve with a value and mock writePoints to throw
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue([{}]),
                getUserEvents: jest.fn().mockResolvedValue([]),
            };
            globals.influx.writePoints.mockImplementation(() => {
                throw new Error('Test error');
            });

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Error saving data to InfluxDB v1! Error: Test error'
                )
            );
        });

        test('should handle errors gracefully (InfluxDB v2)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName') {
                    return 'events_log';
                }
                if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'test-org';
                if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'test-bucket';
                return undefined;
            });
            // Provide at least one event so writePoints is called
            globals.udpEvents = {
                getLogEvents: jest.fn().mockResolvedValue([{}]),
                getUserEvents: jest.fn().mockResolvedValue([]),
            };
            // Mock v2 writeApi to throw error on writePoints
            globals.influx.getWriteApi = jest.fn().mockReturnValue({
                writePoints: jest.fn(() => {
                    throw new Error('Test error');
                }),
            });

            // Execute
            await influxdb.storeEventCountInfluxDB();

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'EVENT COUNT INFLUXDB: Error saving health data to InfluxDB v2! Error: Test error'
                )
            );
        });
    });

    describe('storeRejectedEventCountInfluxDB', () => {
        test('should not store events if no rejected events exist', async () => {
            // Setup
            globals.rejectedEvents = {
                getRejectedLogEvents: jest.fn().mockResolvedValue([]),
            };

            // Execute
            await influxdb.storeRejectedEventCountInfluxDB();

            // Verify
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'REJECTED EVENT COUNT INFLUXDB: No events to store in InfluxDB'
                )
            );
            expect(globals.influxDB.writeApi.writePoint).not.toHaveBeenCalled();
        });

        test('should store rejected events to InfluxDB (InfluxDB v1)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                if (
                    key === 'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
                )
                    return 'events_rejected';
                return undefined;
            });
            const mockRejectedEvents = [
                {
                    source: 'test-source',
                    counter: 7,
                },
            ];
            globals.rejectedEvents = {
                getRejectedLogEvents: jest.fn().mockResolvedValue(mockRejectedEvents),
            };
            // Mock v1 writePoints
            globals.influx = { writePoints: jest.fn() };

            // Execute
            await influxdb.storeRejectedEventCountInfluxDB();

            // Verify
            // Do not check Point for v1
            expect(globals.influx.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'REJECT LOG EVENT INFLUXDB: Sent Butler SOS rejected event count data to InfluxDB'
                )
            );
        });

        test('should store rejected events to InfluxDB (InfluxDB v2)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'test-org';
                if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'test-bucket';
                if (
                    key === 'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
                )
                    return 'events_rejected';
                return undefined;
            });
            const mockRejectedEvents = [
                {
                    source: 'test-source',
                    counter: 7,
                },
            ];
            globals.rejectedEvents = {
                getRejectedLogEvents: jest.fn().mockResolvedValue(mockRejectedEvents),
            };
            // Mock v2 getWriteApi
            const writeApiMock = { writePoints: jest.fn() };
            globals.influx.getWriteApi = jest.fn().mockReturnValue(writeApiMock);

            // Execute
            await influxdb.storeRejectedEventCountInfluxDB();

            // Verify
            expect(Point).toHaveBeenCalledWith('events_rejected');
            expect(globals.influx.getWriteApi).toHaveBeenCalled();
            expect(writeApiMock.writePoints).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'REJECT LOG EVENT INFLUXDB: Sent Butler SOS rejected event count data to InfluxDB'
                )
            );
        });

        test('should handle errors gracefully (InfluxDB v1)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                return undefined;
            });
            const mockRejectedEvents = [
                {
                    source: 'test-source',
                    counter: 7,
                },
            ];
            globals.rejectedEvents = {
                getRejectedLogEvents: jest.fn().mockResolvedValue(mockRejectedEvents),
            };
            // Mock v1 writePoints to throw
            globals.influx = {
                writePoints: jest.fn(() => {
                    throw new Error('Test error');
                }),
            };

            // Execute
            await influxdb.storeRejectedEventCountInfluxDB();

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'REJECT LOG EVENT INFLUXDB: Error saving data to InfluxDB v1! Error: Test error'
                )
            );
        });

        test('should handle errors gracefully (InfluxDB v2)', async () => {
            // Setup
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'test-org';
                if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'test-bucket';
                return undefined;
            });
            const mockRejectedEvents = [
                {
                    source: 'test-source',
                    counter: 7,
                },
            ];
            globals.rejectedEvents = {
                getRejectedLogEvents: jest.fn().mockResolvedValue(mockRejectedEvents),
            };
            // Mock v2 getWriteApi and writePoints to throw
            const writeApiMock = {
                writePoints: jest.fn(() => {
                    throw new Error('Test error');
                }),
            };
            globals.influx.getWriteApi = jest.fn().mockReturnValue(writeApiMock);

            // Execute
            await influxdb.storeRejectedEventCountInfluxDB();

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'REJECTED LOG EVENT INFLUXDB: Error saving data to InfluxDB v2! Error: Test error'
                )
            );
        });
    });

    describe('globals.config.get("Butler-SOS.influxdbConfig.version")', () => {
        let influxdb;
        let globals;
        beforeEach(async () => {
            jest.clearAllMocks();
            influxdb = await import('../post-to-influxdb.js');
            globals = (await import('../../globals.js')).default;
            globals.influx = { writePoints: jest.fn() };
            globals.influxWriteApi = [
                { serverName: 'test-server', writeAPI: { writePoints: jest.fn() } },
            ];
        });

        test('should use InfluxDB v1 path when version is 1', async () => {
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                return undefined;
            });
            const serverName = 'test-server';
            const host = 'test-host';
            const serverTags = { server_name: serverName };
            const healthBody = {
                started: '20220801T121212.000Z',
                apps: { active_docs: [], loaded_docs: [], in_memory_docs: [] },
                cache: { added: 0, hits: 0, lookups: 0, replaced: 0, bytes_added: 0 },
                cpu: { total: 0 },
                mem: { committed: 0, allocated: 0, free: 0 },
                session: { active: 0, total: 0 },
                users: { active: 0, total: 0 },
            };
            await influxdb.postHealthMetricsToInfluxdb(serverName, host, healthBody, serverTags);
            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.influxdbConfig.version');
            expect(globals.influx.writePoints).toHaveBeenCalled();
        });

        test('should use InfluxDB v2 path when version is 2', async () => {
            globals.config.get = jest.fn((key) => {
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.influxdbConfig.includeFields.activeDocs') return false;
                if (key === 'Butler-SOS.influxdbConfig.includeFields.loadedDocs') return false;
                if (key === 'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs') return false;
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                return undefined;
            });
            const serverName = 'test-server';
            const host = 'test-host';
            const serverTags = { server_name: serverName };
            const healthBody = {
                started: '20220801T121212.000Z',
                apps: { active_docs: [], loaded_docs: [], in_memory_docs: [] },
                cache: { added: 0, hits: 0, lookups: 0, replaced: 0, bytes_added: 0 },
                cpu: { total: 0 },
                mem: { committed: 0, allocated: 0, free: 0 },
                session: { active: 0, total: 0 },
                users: { active: 0, total: 0 },
            };
            await influxdb.postHealthMetricsToInfluxdb(serverName, host, healthBody, serverTags);
            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.influxdbConfig.version');
            expect(globals.influxWriteApi[0].writeAPI.writePoints).toHaveBeenCalled();
        });
    });
});
