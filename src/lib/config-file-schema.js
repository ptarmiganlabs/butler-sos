export const confifgFileSchema = {
    'Butler-SOS': {
        logLevel: 'string',
        fileLogging: 'boolean',
        logDirectory: 'string',
        anonTelemetry: 'boolean',
        configVisualisation: {
            enable: 'boolean',
            host: 'string',
            port: 'number',
            obfuscate: 'boolean',
        },
        heartbeat: {
            enable: 'boolean',
            remoteURL: 'string',
            frequency: 'string',
        },
        dockerHealthCheck: {
            enable: 'boolean',
            port: 'number',
        },
        uptimeMonitor: {
            enable: 'boolean',
            frequency: 'string',
            logLevel: 'string',
            storeInInfluxdb: {
                butlerSOSMemoryUsage: 'boolean',
                instanceTag: 'string',
            },
            storeNewRelic: {
                enable: 'boolean',
                'destinationAccount?': ['string'],
                metric: {
                    dynamic: {
                        butlerMemoryUsage: {
                            enable: 'boolean',
                        },
                        butlerUptime: {
                            enable: 'boolean',
                        },
                    },
                },
                attribute: {
                    'static?': [
                        {
                            name: 'string',
                            value: 'string',
                        },
                    ],
                    dynamic: {
                        butlerVersion: {
                            enable: 'boolean',
                        },
                    },
                },
            },
        },

        'thirdPartyToolsCredentials?': {
            newRelic: [
                {
                    accountName: 'string',
                    insertApiKey: 'string',
                    accountId: 'number',
                },
            ],
        },
        userEvents: {
            enable: 'boolean',
            'excludeUser?': [
                {
                    directory: 'string',
                    userId: 'string',
                },
            ],
            udpServerConfig: {
                serverHost: 'string',
                portUserActivityEvents: 'number',
            },
            'tags?': [
                {
                    tag: 'string',
                    value: 'string',
                },
            ],
            sendToMQTT: {
                enable: 'boolean',
                postTo: {
                    everythingTopic: {
                        enable: 'boolean',
                        topic: 'string',
                    },
                    sessionStartTopic: {
                        enable: 'boolean',
                        topic: 'string',
                    },
                    sessionStopTopic: {
                        enable: 'boolean',
                        topic: 'string',
                    },
                    connectionOpenTopic: {
                        enable: 'boolean',
                        topic: 'string',
                    },
                    connectionCloseTopic: {
                        enable: 'boolean',
                        topic: 'string',
                    },
                },
            },
            sendToInfluxdb: {
                enable: 'boolean',
            },
            sendToNewRelic: {
                enable: 'boolean',
                'destinationAccount?': ['string'],
                scramble: 'boolean',
            },
        },
        logEvents: {
            udpServerConfig: {
                serverHost: 'string',
                portLogEvents: 'number',
            },
            'tags?': [
                {
                    tag: 'string',
                    value: 'string',
                },
            ],
            source: {
                engine: {
                    enable: 'boolean',
                },
                proxy: {
                    enable: 'boolean',
                },
                repository: {
                    enable: 'boolean',
                },
                scheduler: {
                    enable: 'boolean',
                },
            },
            categorise: {
                enable: 'boolean',
                rules: [
                    {
                        description: 'string',
                        logLevel: ['string'],
                        action: 'string',
                        category: [
                            {
                                name: 'string',
                                value: 'string',
                            },
                        ],
                        filter: [
                            {
                                type: 'string',
                                value: 'string',
                            },
                        ],
                    },
                ],
                ruleDefault: {
                    enable: 'boolean',
                    category: [
                        {
                            name: 'string',
                            value: 'string',
                        },
                    ],
                },
            },
            appPerformanceMonitor: {
                enable: 'boolean',
                appNameLookup: {
                    enable: 'boolean',
                },
                monitorFilter: {
                    allApps: {
                        enable: 'boolean',
                        'appExclude?': [
                            {
                                'appId?': 'string',
                                'appName?': 'string',
                            },
                        ],
                        objectType: {
                            allObjectTypes: 'boolean',
                            'allObjectTypesExclude?': [],
                            'someObjectTypesInclude?': [],
                        },
                        method: {
                            allMethods: 'boolean',
                            'allMethodsExclude?': [],
                            'someMethodsInclude?': [],
                        },
                    },
                    appSpecific: {
                        enable: 'boolean',
                        app: [
                            {
                                'include?': [
                                    {
                                        'appId?': 'string',
                                        'appName?': 'string',
                                    },
                                ],
                                objectType: {
                                    allObjectTypes: 'boolean',
                                    'allObjectTypesExclude?': [],
                                    'someObjectTypesInclude?': [],
                                },
                                appObject: {
                                    allAppObjects: 'boolean',
                                    'allAppObjectsExclude?': [
                                        {
                                            objectId: 'string',
                                        },
                                    ],
                                    'someAppObjectsInclude?': [
                                        {
                                            objectId: 'string',
                                        },
                                    ],
                                },
                                method: {
                                    allMethods: 'boolean',
                                    'allMethodsExclude?': [],
                                    'someMethodsInclude?': [],
                                },
                            },
                        ],
                    },
                },
            },
            sendToMQTT: {
                enable: 'boolean',
                baseTopic: 'string',
                postTo: {
                    baseTopic: 'boolean',
                    subsystemTopics: 'boolean',
                },
            },
            sendToInfluxdb: {
                enable: 'boolean',
            },
            sendToNewRelic: {
                enable: 'boolean',
                'destinationAccount?': ['string'],
                source: {
                    engine: {
                        enable: 'boolean',
                        logLevel: {
                            error: 'boolean',
                            warn: 'boolean',
                        },
                    },
                    proxy: {
                        enable: 'boolean',
                        logLevel: {
                            error: 'boolean',
                            warn: 'boolean',
                        },
                    },
                    repository: {
                        enable: 'boolean',
                        logLevel: {
                            error: 'boolean',
                            warn: 'boolean',
                        },
                    },
                    scheduler: {
                        enable: 'boolean',
                        logLevel: {
                            error: 'boolean',
                            warn: 'boolean',
                        },
                    },
                },
            },
        },

        logdb: {
            enable: 'boolean',
            pollingInterval: 'number',
            queryPeriod: 'string',
            host: 'string',
            port: 'number',
            qlogsReaderUser: 'string',
            qlogsReaderPwd: 'string',
            extractErrors: 'boolean',
            extractWarnings: 'boolean',
            extractInfo: 'boolean',
        },
        cert: {
            clientCert: 'string',
            clientCertKey: 'string',
            clientCertCA: 'string',
        },
        mqttConfig: {
            enable: 'boolean',
            brokerHost: 'string',
            brokerPort: 'number',
            baseTopic: 'string',
        },
        newRelic: {
            enable: 'boolean',
            event: {
                url: 'string',
                'header?': [
                    {
                        name: 'string',
                        value: 'string',
                    },
                ],
                attribute: {
                    'static?': [
                        {
                            name: 'string',
                            value: 'string',
                        },
                    ],
                    dynamic: {
                        butlerSosVersion: {
                            enable: 'boolean',
                        },
                    },
                },
            },
            metric: {
                'destinationAccount?': ['string'],
                url: 'string',
                'header?': [
                    {
                        name: 'string',
                        value: 'string',
                    },
                ],
                dynamic: {
                    engine: {
                        memory: {
                            enable: 'boolean',
                        },
                        cpu: {
                            enable: 'boolean',
                        },
                        calls: {
                            enable: 'boolean',
                        },
                        selections: {
                            enable: 'boolean',
                        },
                        sessions: {
                            enable: 'boolean',
                        },
                        users: {
                            enable: 'boolean',
                        },
                        saturated: {
                            enable: 'boolean',
                        },
                    },
                    apps: {
                        docCount: {
                            enable: 'boolean',
                        },
                        activeDocs: {
                            enable: 'boolean',
                        },
                        loadedDocs: {
                            enable: 'boolean',
                        },
                        inMemoryDocs: {
                            enable: 'boolean',
                        },
                    },
                    cache: {
                        cache: {
                            enable: 'boolean',
                        },
                    },
                    proxy: {
                        sessions: {
                            enable: 'boolean',
                        },
                    },
                },
                attribute: {
                    'static?': [
                        {
                            name: 'string',
                            value: 'string',
                        },
                    ],
                    dynamic: {
                        butlerSosVersion: {
                            enable: 'boolean',
                        },
                    },
                },
            },
        },
        prometheus: {
            enable: 'boolean',
            host: 'string',
            port: 'number',
        },
        influxdbConfig: {
            enable: 'boolean',
            host: 'string',
            port: 'number',
            version: 'number',
            v2Config: {
                org: 'string',
                bucket: 'string',
                description: 'string',
                token: 'string',
                retentionDuration: 'string',
            },
            v1Config: {
                auth: {
                    enable: 'boolean',
                    username: 'string',
                    password: 'string',
                },
                dbName: 'string',
                retentionPolicy: {
                    name: 'string',
                    duration: 'string',
                },
            },
            includeFields: {
                activeDocs: 'boolean',
                loadedDocs: 'boolean',
                inMemoryDocs: 'boolean',
            },
        },
        appNames: {
            enableAppNameExtract: 'boolean',
            extractInterval: 'number',
            hostIP: 'string',
        },
        'userSessions?': {
            enableSessionExtract: 'boolean',
            pollingInterval: 'number',
            excludeUser: [
                {
                    directory: 'string',
                    userId: 'string',
                },
            ],
        },
        serversToMonitor: {
            pollingInterval: 'number',
            rejectUnauthorized: 'boolean',
            'serverTagsDefinition?': ['string'],
            servers: [
                {
                    host: 'string',
                    serverName: 'string',
                    serverDescription: 'string',
                    logDbHost: 'string',
                    userSessions: {
                        enable: 'boolean',
                        host: 'string',
                        virtualProxies: [
                            {
                                virtualProxy: 'string',
                            },
                        ],
                    },
                    'serverTags?': [],
                },
            ],
        },
    },
};
