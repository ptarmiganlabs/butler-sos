import { describe, test, expect, beforeEach, afterAll, jest } from '@jest/globals';

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
const mockVerifyHost = jest.fn();
const mockHostnamePattern =
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/u;

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(),
    },
}));

jest.unstable_mockModule('js-yaml', () => ({
    load: jest.fn(),
}));

jest.unstable_mockModule('../host-utils.js', () => ({
    hostnamePattern: mockHostnamePattern,
    verifyHost: mockVerifyHost,
}));

const fs = (await import('fs/promises')).default;
const { load } = await import('js-yaml');
const { verifyConfigFileSchema, verifyAppConfig } = await import('../config-file-verify.js');

describe('config-file-verify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerifyHost.mockReset();
    });

    afterAll(() => {
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
        mockConsoleWarn.mockRestore();
    });

    describe('verifyConfigFileSchema', () => {
        test('reports a YAML parse error once, with its line and column', async () => {
            // A YAML parse error used to print js-yaml's message, then return false so the caller
            // printed a second, vaguer line on top. It is now one problem in one report.
            fs.readFile.mockResolvedValue('invalid yaml');
            const parseError = new Error('Parse error');
            parseError.reason = 'bad indentation of a mapping entry';
            parseError.mark = { line: 2, column: 1, snippet: ' 3 |  c: 2' };
            load.mockImplementation(() => {
                throw parseError;
            });

            const result = await verifyConfigFileSchema('config.yaml');
            expect(result).toBe(false);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            const report = mockConsoleError.mock.calls[0][0];
            expect(report).toContain('Config file config.yaml has 1 problem:');
            expect(report).toContain(
                'line 3, col 2  The file is not valid YAML: bad indentation of a mapping entry.'
            );
            expect(report).toContain('Fix this and start Butler SOS again.');
        });

        test('returns false and prints one report on a schema violation, without exiting', async () => {
            // The exit belongs to the caller, so that a check can report its result instead of
            // ending the process.
            fs.readFile.mockResolvedValue('Butler-SOS: {}\n');
            load.mockReturnValue({ 'Butler-SOS': {} });

            // This will fail because it tries to validate against the real schema
            // which has many required fields.
            const result = await verifyConfigFileSchema('config.yaml');
            expect(result).toBe(false);
            expect(mockExit).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            const report = mockConsoleError.mock.calls[0][0];
            expect(report).toMatch(/^Config file config\.yaml has \d+ problems:/);
            expect(report).toContain('Butler-SOS.logLevel');
            expect(report).toContain('is missing. Add it under Butler-SOS.');
            expect(report).not.toContain('VERIFY CONFIG FILE ERROR');
        });

        test('reports a file that cannot be read as one problem', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

            const result = await verifyConfigFileSchema('config.yaml');
            expect(result).toBe(false);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(mockConsoleError.mock.calls[0][0]).toContain(
                'The file could not be read: ENOENT: no such file or directory'
            );
        });
    });

    describe('verifyAppConfig', () => {
        let mockCfg;

        beforeEach(() => {
            mockCfg = {
                get: jest.fn(),
                // node-config returns true from has() for any configured key, including one
                // whose value is explicitly null — only a completely absent path gives false.
                // Each test's get() mock answers every key (falling through to null), so the
                // faithful stand-in is a has() that always agrees.
                has: jest.fn(() => true),
                set: jest.fn(),
            };
        });

        test('returns true for valid app config', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(true);
        });

        test('validates InfluxDB version', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 4; // Invalid
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('warns when server polling is on but no servers are configured', async () => {
            // A null/empty servers list used to stop startup by throwing. Now it is read as an
            // empty list, so Butler SOS starts and monitors nothing — this warning is the only
            // thing telling the administrator why no data appears.
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.userSessions.enableSessionExtract') return true;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return null;
                if (key === 'Butler-SOS.serversToMonitor.servers') return null;
                return null;
            });

            const result = await verifyAppConfig(mockCfg);

            expect(result).toBe(true);
            expect(mockConsoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('Butler-SOS.serversToMonitor.servers is empty')
            );
        });

        test('does not warn about empty servers on a UDP-only deployment', async () => {
            // Butler SOS used purely as a sink for Qlik Sense log/user events has no servers to
            // poll. Warning there would train operators to ignore warnings — an info line is
            // enough for the administrator wondering where their server data went.
            //
            // influxdbConfig.enable is TRUE here on purpose: a UDP-only deployment normally
            // stores its events in InfluxDB. An earlier gate keyed the warning to that flag
            // (its pollingInterval clause was vacuous — the schema requires the key), so this
            // exact configuration warned on every startup.
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 2;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.userSessions.enableSessionExtract') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return null;
                if (key === 'Butler-SOS.serversToMonitor.servers') return null;
                return null;
            });

            await verifyAppConfig(mockCfg);

            expect(mockConsoleWarn).not.toHaveBeenCalledWith(
                expect.stringContaining('Butler-SOS.serversToMonitor.servers is empty')
            );
            expect(mockConsoleInfo).toHaveBeenCalledWith(
                expect.stringContaining('Butler-SOS.serversToMonitor.servers is empty')
            );
        });

        test('warns about the userEvents account list when only newRelic.enable is on', async () => {
            // Health metrics and proxy sessions read this list while gated on newRelic.enable,
            // not on userEvents.sendToNewRelic.enable. Keying the warning to the matching name
            // alone left the two largest consumers silent.
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [{ serverName: 'S1' }];
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.userEvents.sendToNewRelic.enable') return false;
                if (key === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount') return null;
                return null;
            });

            await verifyAppConfig(mockCfg);

            expect(mockConsoleWarn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Butler-SOS.userEvents.sendToNewRelic.destinationAccount is empty'
                )
            );
        });

        test.each([
            ['userEvents', 'Butler-SOS.userEvents.sendToNewRelic'],
            ['logEvents', 'Butler-SOS.logEvents.sendToNewRelic'],
            ['uptimeMonitor', 'Butler-SOS.uptimeMonitor.storeNewRelic'],
        ])('warns when %s New Relic is enabled with no destination account', async (_l, prefix) => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [{ serverName: 'S1' }];
                if (key === `${prefix}.enable`) return true;
                // The template ships every destinationAccount commented out, i.e. null.
                if (key === `${prefix}.destinationAccount`) return null;
                return null;
            });

            const result = await verifyAppConfig(mockCfg);

            expect(result).toBe(true);
            expect(mockConsoleWarn).toHaveBeenCalledWith(
                expect.stringContaining(`${prefix}.destinationAccount is empty`)
            );
        });

        test('does not warn about New Relic when the feature is disabled', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [{ serverName: 'S1' }];
                if (key === 'Butler-SOS.userEvents.sendToNewRelic.enable') return false;
                return null;
            });

            await verifyAppConfig(mockCfg);

            expect(mockConsoleWarn).not.toHaveBeenCalledWith(
                expect.stringContaining('destinationAccount is empty')
            );
        });

        test('accepts an out-of-range maxBatchSize without writing to config', async () => {
            // maxBatchSize defaulting moved to config-loader.js, because it means writing to
            // the config object: node-config has no set() method, and freezes properties on
            // first read anyway. This test used to assert `mockCfg.set` was called — a method
            // the real config object does not have — which is what hid the bug.
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 20000; // Too large
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });
            mockCfg.has.mockReturnValue(true);

            const result = await verifyAppConfig(mockCfg);

            expect(result).toBe(true);
            expect(mockCfg.set).not.toHaveBeenCalled();
        });

        test('validates telemetry vs system info', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return true;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('validates server tags - missing tag on server', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return ['tag1'];
                if (key === 'Butler-SOS.serversToMonitor.servers')
                    return [{ serverName: 'S1', serverTags: {} }];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringMatching(
                    /Butler-SOS\.serversToMonitor\.servers\[0\]\.serverTags\n\s+has no tag "tag1" \(server "S1"\)\./
                )
            );
        });

        test('validates server tags - extra tag on server', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return ['tag1'];
                if (key === 'Butler-SOS.serversToMonitor.servers')
                    return [{ serverName: 'S1', serverTags: { tag1: 'v1', tag2: 'v2' } }];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringMatching(
                    /Butler-SOS\.serversToMonitor\.servers\[0\]\.serverTags\.tag2\n\s+is not listed in Butler-SOS\.serversToMonitor\.serverTagsDefinition \(server "S1"\)\./
                )
            );
        });

        test('reports every problem in one report, with lines from the config file', async () => {
            // These checks used to stop at the first failure, so fixing one only revealed the
            // next. All of them now go into one report, in the same format as the schema check.
            fs.readFile.mockResolvedValue(
                [
                    'Butler-SOS:',
                    '  anonTelemetry: true',
                    '  influxdbConfig:',
                    '    enable: true',
                    '    version: 4',
                    '  serversToMonitor:',
                    '    serverTagsDefinition:',
                    '      - tag1',
                    '    servers:',
                    '      - serverName: S1',
                    '        serverTags:',
                    '          tag1: null',
                    '          tag2: v2',
                    '',
                ].join('\n')
            );
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 4;
                if (key === 'Butler-SOS.anonTelemetry') return true;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return ['tag1'];
                if (key === 'Butler-SOS.serversToMonitor.servers')
                    return [{ serverName: 'S1', serverTags: { tag1: null, tag2: 'v2' } }];
                return null;
            });

            const result = await verifyAppConfig(mockCfg, { configFile: 'production.yaml' });
            expect(result).toBe(false);
            expect(fs.readFile).toHaveBeenCalledWith('production.yaml', 'utf8');
            expect(mockConsoleError).toHaveBeenCalledTimes(1);

            const report = mockConsoleError.mock.calls[0][0];
            expect(report).toContain('Config file production.yaml has 4 problems:');
            expect(report).toMatch(/line 2, col 3 +Butler-SOS\.anonTelemetry\n/);
            expect(report).toMatch(/line 5, col 5 +Butler-SOS\.influxdbConfig\.version\n/);
            expect(report).toContain('is 4, but must be 1, 2 or 3.');
            expect(report).toMatch(
                /line 12, col 11 +Butler-SOS\.serversToMonitor\.servers\[0\]\.serverTags\.tag1\n/
            );
            expect(report).toMatch(
                /line 13, col 11 +Butler-SOS\.serversToMonitor\.servers\[0\]\.serverTags\.tag2\n/
            );
            // Sorted by line, as in the file.
            expect(report.indexOf('anonTelemetry')).toBeLessThan(report.indexOf('version'));
            expect(report.indexOf('tag1\n')).toBeLessThan(report.indexOf('tag2\n'));
        });

        test('handles error in server tags verification', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') {
                    throw new Error('Unexpected error');
                }
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('accepts app name host values that resolve to an IP address', async () => {
            mockVerifyHost.mockResolvedValueOnce({ resolvesToIp: true, tcpReachable: true });
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return true;
                if (key === 'Butler-SOS.appNames.hostIP') return '127.0.0.1';
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(true);
            expect(mockVerifyHost).toHaveBeenCalledWith('127.0.0.1', 4242);
            // Scoped to the appNames warning this test is about. A blanket "no warnings at
            // all" assertion also covered every unrelated warning verifyAppConfig may emit —
            // this config has an empty servers list, which is now reported separately.
            expect(mockConsoleWarn).not.toHaveBeenCalledWith(
                expect.stringContaining('Butler-SOS.appNames.hostIP')
            );
        });

        test('rejects app name host values that cannot resolve to an IP address', async () => {
            mockVerifyHost.mockResolvedValueOnce({ resolvesToIp: false, tcpReachable: null });
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return true;
                if (key === 'Butler-SOS.appNames.hostIP') return 'invalid host name';
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
            expect(mockVerifyHost).toHaveBeenCalledTimes(1);
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringMatching(
                    /Butler-SOS\.appNames\.hostIP\n\s+is "invalid host name", which is not an IPv4 address and does not resolve to one\./
                )
            );
        });

        test('warns when app name host resolves to IPv4 but is not reachable during startup', async () => {
            mockVerifyHost.mockResolvedValueOnce({ resolvesToIp: true, tcpReachable: false });
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.appNames.enableAppNameExtract') return true;
                if (key === 'Butler-SOS.appNames.hostIP') return '127.0.0.1';
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(true);
            expect(mockVerifyHost).toHaveBeenCalledWith('127.0.0.1', 4242);
            expect(mockConsoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('could not reach 127.0.0.1:4242 during startup')
            );
        });
    });
});
