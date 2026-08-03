import { jest } from '@jest/globals';

/**
 * Stand-in for the globals `getErrorMessage` method.
 *
 * @param {Error} err - The error to format.
 * @returns {string} The error message.
 */
function fakeGetErrorMessage(err) {
    return err.message;
}

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: { error: jest.fn() },
        getErrorMessage: fakeGetErrorMessage,
    },
}));

const configObfuscate = (await import('../config-obfuscate.js')).default;

/** Sentinel values — if any of these survive obfuscation, a secret is leaking. */
const SECRETS = {
    influxV3Token: 'SECRET-influxdb-v3-token',
    influxV2Token: 'SECRET-influxdb-v2-token',
    influxV1Password: 'SECRET-influxdb-v1-password',
    certPassphrase: 'SECRET-client-cert-passphrase',
    auditApiToken: 'SECRET-audit-api-token',
    auditTlsPassphrase: 'SECRET-audit-tls-passphrase',
    auditInfluxV3Token: 'SECRET-audit-influx-v3-token',
    auditInfluxV2Token: 'SECRET-audit-influx-v2-token',
    auditInfluxV1Password: 'SECRET-audit-influx-v1-password',
    newRelicApiKey: 'SECRET-new-relic-insert-api-key',
};

/**
 * Builds a config covering every credential-bearing path in the config schemas, plus the
 * paths that carry partial-masking rules.
 *
 * @returns {object} A representative Butler SOS config object.
 */
function buildConfig() {
    return {
        'Butler-SOS': {
            configVisualisation: { enable: true, host: 'localhost', port: 3100 },
            heartbeat: { enable: true, remoteURL: 'http://monitoring.example.com/ping/abc' },
            thirdPartyToolsCredentials: {
                newRelic: [
                    {
                        accountName: 'prod',
                        insertApiKey: SECRETS.newRelicApiKey,
                        accountId: '1234567890',
                    },
                ],
            },
            cert: {
                clientCert: './config/certificate/client.pem',
                clientCertKey: './config/certificate/client_key.pem',
                clientCertCA: './config/certificate/root.pem',
                clientCertPassphrase: SECRETS.certPassphrase,
            },
            userEvents: {
                enable: true,
                udpServerConfig: { serverHost: '10.0.0.15', portUserActivityEvents: 9997 },
                sendToMQTT: {
                    postTo: {
                        everythingTopic: {
                            enable: true,
                            topic: 'butler-sos/user-event/everything',
                        },
                        sessionStartTopic: { enable: true, topic: 'butler-sos/user-event/start' },
                        sessionStopTopic: { enable: true, topic: 'butler-sos/user-event/stop' },
                        connectionOpenTopic: { enable: true, topic: 'butler-sos/user-event/open' },
                        connectionCloseTopic: {
                            enable: true,
                            topic: 'butler-sos/user-event/close',
                        },
                    },
                },
            },
            logEvents: {
                udpServerConfig: { serverHost: '10.0.0.16', portLogEvents: 9996 },
                sendToMQTT: { enable: true, baseTopic: 'butler-sos/log-event/base' },
                enginePerformanceMonitor: {
                    monitorFilter: {
                        appSpecific: {
                            app: [
                                {
                                    include: [
                                        {
                                            appId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                                            appName: 'Sales Dashboard Q4',
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
            mqttConfig: { enable: true, brokerHost: 'mqtt.example.com', brokerPort: 1883 },
            prometheus: {
                enable: true,
                host: '10.0.0.20',
                port: 9842,
                nodeMetricsHost: '10.0.0.20',
                nodeMetricsPort: 9001,
            },
            influxdbConfig: {
                enable: true,
                host: 'influxdb.example.com',
                port: 8086,
                version: 3,
                v3Config: {
                    database: 'butler-sos',
                    description: 'v3',
                    token: SECRETS.influxV3Token,
                    retentionDuration: '10d',
                },
                v2Config: {
                    org: 'ptarmiganlabs',
                    bucket: 'butler-sos',
                    description: 'v2',
                    token: SECRETS.influxV2Token,
                    retentionDuration: '10d',
                },
                v1Config: {
                    auth: {
                        enable: true,
                        username: 'influxuser',
                        password: SECRETS.influxV1Password,
                    },
                    dbName: 'butler-sos',
                    retentionPolicy: { name: '10d', duration: '10d' },
                },
            },
            appNames: { enableAppNameExtract: true, hostIP: '10.0.0.30' },
            serversToMonitor: {
                rejectUnauthorized: true,
                servers: [
                    {
                        host: 'qs-node1.example.com:4747',
                        serverName: 'node1',
                        userSessions: {
                            enable: true,
                            host: 'qs-node1.example.com:4243',
                            virtualProxies: [
                                { virtualProxy: '/finance-restricted' },
                                { virtualProxy: '/hr-payroll' },
                            ],
                        },
                        headers: {
                            'X-Qlik-User': 'UserDirectory=Internal;UserId=sa_repository',
                            'X-Custom.Dotted': 'some-header-value',
                            'X-Api-Key': 'SECRET-hyphenated-api-key',
                        },
                    },
                ],
            },
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: SECRETS.auditApiToken,
                tls: {
                    enable: true,
                    cert: './cert/audit.pem',
                    key: './cert/audit_key.pem',
                    passphrase: SECRETS.auditTlsPassphrase,
                },
                destination: {
                    influxdb: {
                        metadata: {
                            v3Config: {
                                database: 'audit',
                                token: SECRETS.auditInfluxV3Token,
                                retentionDuration: '30d',
                            },
                            v2Config: {
                                org: 'ptarmiganlabs',
                                bucket: 'audit',
                                token: SECRETS.auditInfluxV2Token,
                                retentionDuration: '30d',
                            },
                            v1Config: {
                                auth: {
                                    enable: true,
                                    username: 'audituser',
                                    password: SECRETS.auditInfluxV1Password,
                                },
                                dbName: 'audit',
                            },
                        },
                    },
                },
            },
        },
    };
}

describe('configObfuscate', () => {
    describe('secret redaction', () => {
        // This is the durable guard. The previous implementation was a hand-maintained list
        // of explicit paths and had silently drifted from the schema, leaving the InfluxDB
        // v3 token, the audit TLS passphrase and the audit v1 password in plaintext.
        test.each(Object.entries(SECRETS))(
            'does not leak %s anywhere in the output',
            (_name, secretValue) => {
                // Assert the sentinel is actually wired into the fixture first. Without this
                // the case passes vacuously for any secret someone adds to SECRETS but
                // forgets to place in buildConfig() — a green test guarding nothing.
                expect(JSON.stringify(buildConfig())).toContain(secretValue);

                const result = configObfuscate(buildConfig());
                expect(JSON.stringify(result)).not.toContain(secretValue);
            }
        );

        test('leaks no secret sentinel at all', () => {
            const serialised = JSON.stringify(configObfuscate(buildConfig()));
            expect(serialised).not.toContain('SECRET-');
        });

        test('masks credentials at previously-missed paths', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.influxdbConfig.v3Config.token).toBe('**********');
            expect(cfg.auditEvents.tls.passphrase).toBe('**********');
            expect(cfg.auditEvents.destination.influxdb.metadata.v1Config.auth.password).toBe(
                '**********'
            );
        });

        test('masks a newly added secret key without any change to the obfuscator', () => {
            const config = buildConfig();
            config['Butler-SOS'].someFutureFeature = {
                enable: true,
                endpoint: 'https://example.com',
                apiToken: 'SECRET-not-yet-invented',
                nested: { deeply: { password: 'SECRET-deeply-nested' } },
            };

            const serialised = JSON.stringify(configObfuscate(config));
            expect(serialised).not.toContain('SECRET-not-yet-invented');
            expect(serialised).not.toContain('SECRET-deeply-nested');
        });

        // The scalar-only version of the rule above shipped and was wrong: a secret-named key
        // holding an array or object skipped the mask entirely, because the guard required
        // the value to be a primitive and array elements have numeric keys that never match.
        test('masks a secret held in an array, preserving structure', () => {
            const config = buildConfig();
            config['Butler-SOS'].auditEvents.apiTokens = [
                'SECRET-array-token-1',
                'SECRET-array-token-2',
            ];

            const cfg = configObfuscate(config)['Butler-SOS'];

            expect(cfg.auditEvents.apiTokens).toEqual(['**********', '**********']);
        });

        test('masks a secret held in an object, preserving structure', () => {
            const config = buildConfig();
            config['Butler-SOS'].someFeature = {
                secretStore: { primary: 'SECRET-obj-1', backup: 'SECRET-obj-2' },
            };

            const cfg = configObfuscate(config)['Butler-SOS'];

            expect(cfg.someFeature.secretStore).toEqual({
                primary: '**********',
                backup: '**********',
            });
        });

        test('masks New Relic ingest API keys held in {name, value} header pairs', () => {
            const config = buildConfig();
            config['Butler-SOS'].newRelic = {
                event: {
                    url: 'https://insights-collector.newrelic.com/v1/accounts/',
                    header: [{ name: 'Api-Key', value: 'SECRET-nr-event-ingest-key' }],
                    attribute: {
                        // Same {name, value} shape, but these are dimensions, not credentials.
                        static: [{ name: 'qs_env', value: 'production' }],
                    },
                },
                metric: {
                    url: 'https://metric-api.newrelic.com/metric/v1',
                    header: [{ name: 'Api-Key', value: 'SECRET-nr-metric-ingest-key' }],
                },
            };

            const cfg = configObfuscate(config)['Butler-SOS'];

            expect(cfg.newRelic.event.header[0].value).toBe('**********');
            expect(cfg.newRelic.metric.header[0].value).toBe('**********');
            // Header names stay readable, and identically-shaped attributes are not over-masked.
            expect(cfg.newRelic.event.header[0].name).toBe('Api-Key');
            expect(cfg.newRelic.event.attribute.static[0].value).toBe('production');
        });

        test('fully masks a hyphenated api key header name', () => {
            const server = configObfuscate(buildConfig())['Butler-SOS'].serversToMonitor.servers[0];

            // X-Api-Key previously fell through to the 5-char header rule because the key-name
            // pattern required `apikey` contiguous; the shared pattern accepts api[_-]?key.
            expect(server.headers['X-Api-Key']).toBe('**********');
        });
    });

    // These guard against the opposite failure: a keyword loose enough to match container and
    // flag names, masking booleans and fields that carry deliberate partial rules.
    describe('over-masking guards', () => {
        test('does not mask the rejectUnauthorized boolean', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.serversToMonitor.rejectUnauthorized).toBe(true);
        });

        test('recurses into the v1Config.auth container instead of masking it wholesale', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.influxdbConfig.v1Config.auth.password).toBe('**********');
            expect(cfg.influxdbConfig.v1Config.auth.username).toBe('inf**********');
            expect(cfg.influxdbConfig.v1Config.auth.enable).toBe(true);
        });

        test('recurses into thirdPartyToolsCredentials instead of masking it wholesale', () => {
            const nr =
                configObfuscate(buildConfig())['Butler-SOS'].thirdPartyToolsCredentials.newRelic[0];

            expect(nr.insertApiKey).toBe('**********');
            expect(nr.accountId).toBe('123**********');
            expect(nr.accountName).toBe('prod');
        });
    });

    describe('partial masking', () => {
        test('keeps a readable prefix for environment details', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.configVisualisation.host).toBe('loc**********');
            expect(cfg.heartbeat.remoteURL).toBe('http://mon**********');
            expect(cfg.mqttConfig.brokerHost).toBe('mqt**********');
            expect(cfg.prometheus.host).toBe('10.**********');
            expect(cfg.influxdbConfig.host).toBe('inf**********');
            expect(cfg.influxdbConfig.v2Config.org).toBe('pta**********');
            expect(cfg.influxdbConfig.v2Config.bucket).toBe('but**********');
            expect(cfg.influxdbConfig.v1Config.auth.username).toBe('inf**********');
            expect(cfg.appNames.hostIP).toBe('10.**********');
            expect(cfg.cert.clientCert).toBe('./config/c**********');
            expect(cfg.userEvents.udpServerConfig.serverHost).toBe('10.**********');
            expect(cfg.logEvents.udpServerConfig.serverHost).toBe('10.**********');
            expect(cfg.logEvents.sendToMQTT.baseTopic).toBe('butler-sos**********');
        });

        test('masks inside arrays', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.serversToMonitor.servers[0].host).toBe('qs-**********');
            expect(cfg.thirdPartyToolsCredentials.newRelic[0].accountId).toBe('123**********');

            const include =
                cfg.logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[0].include[0];
            expect(include.appId).toBe('aaaaa**********');
            expect(include.appName).toBe('Sales**********');
        });

        test('masks operator-defined header values, including dotted header names', () => {
            const server = configObfuscate(buildConfig())['Butler-SOS'].serversToMonitor.servers[0];

            expect(server.headers['X-Qlik-User']).toBe('UserD**********');
            expect(server.headers['X-Custom.Dotted']).toBe('some-**********');
        });

        test('preserves the userSessions object while masking its host and virtual proxies', () => {
            const server = configObfuscate(buildConfig())['Butler-SOS'].serversToMonitor.servers[0];

            // Two regressions guarded here. The original implementation replaced the whole
            // userSessions object with a string, losing the `enable` flag. The first fix for
            // that masked only `host`, which exposed virtualProxies — internal Qlik URL
            // topology, often named after business units.
            expect(server.userSessions).toEqual({
                enable: true,
                host: 'qs-**********',
                virtualProxies: [
                    { virtualProxy: '/fi**********' },
                    { virtualProxy: '/hr**********' },
                ],
            });
        });

        test('masks prometheus.nodeMetricsHost like prometheus.host', () => {
            const prom = configObfuscate(buildConfig())['Butler-SOS'].prometheus;

            // The two normally hold the same value, so leaving nodeMetricsHost readable
            // would make masking host pointless.
            expect(prom.host).toBe('10.**********');
            expect(prom.nodeMetricsHost).toBe('10.**********');
            expect(prom.nodeMetricsPort).toBe(9001);
        });
    });

    describe('structural behaviour', () => {
        test('does not mutate the input config', () => {
            const config = buildConfig();
            const before = JSON.stringify(config);

            configObfuscate(config);

            expect(JSON.stringify(config)).toBe(before);
        });

        test('preserves non-sensitive values and structure', () => {
            const cfg = configObfuscate(buildConfig())['Butler-SOS'];

            expect(cfg.configVisualisation.port).toBe(3100);
            expect(cfg.influxdbConfig.version).toBe(3);
            expect(cfg.serversToMonitor.rejectUnauthorized).toBe(true);
            expect(cfg.serversToMonitor.servers[0].serverName).toBe('node1');
            expect(cfg.thirdPartyToolsCredentials.newRelic[0].accountName).toBe('prod');
            expect(Array.isArray(cfg.thirdPartyToolsCredentials.newRelic)).toBe(true);
        });

        test('tolerates a minimal config without throwing', () => {
            expect(() => configObfuscate({ 'Butler-SOS': {} })).not.toThrow();
            expect(() => configObfuscate({})).not.toThrow();
            expect(() => configObfuscate({ 'Butler-SOS': { cert: {} } })).not.toThrow();
        });

        test('leaves nullish optional secrets untouched rather than inventing a mask', () => {
            const result = configObfuscate({
                'Butler-SOS': { cert: { clientCertPassphrase: null } },
            });

            expect(result['Butler-SOS'].cert.clientCertPassphrase).toBeNull();
        });
    });
});
