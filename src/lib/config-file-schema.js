export const confifgFileSchema = {
    type: 'object',
    properties: {
        'Butler-SOS': {
            type: 'object',
            properties: {
                logLevel: {
                    type: 'string',
                    enum: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
                    transform: ['trim', 'toLowerCase'],
                },
                fileLogging: { type: 'boolean' },
                logDirectory: { type: 'string' },
                anonTelemetry: { type: 'boolean' },
                configVisualisation: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        host: { type: 'string' },
                        port: { type: 'number' },
                        obfuscate: { type: 'boolean' },
                    },
                    required: ['enable', 'host', 'port', 'obfuscate'],
                    additionalProperties: false,
                },
                heartbeat: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        remoteURL: { type: 'string' },
                        frequency: { type: 'string' },
                    },
                    required: ['enable', 'remoteURL', 'frequency'],
                    additionalProperties: false,
                },
                dockerHealthCheck: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        port: { type: 'number' },
                    },
                    required: ['enable', 'port'],
                    additionalProperties: false,
                },
                uptimeMonitor: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        frequency: { type: 'string' },
                        logLevel: {
                            type: 'string',
                            enum: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
                            transform: ['trim', 'toLowerCase'],
                        },
                        storeInInfluxdb: {
                            type: 'object',
                            properties: {
                                butlerSOSMemoryUsage: { type: 'boolean' },
                                instanceTag: { type: 'string' },
                            },
                            required: ['butlerSOSMemoryUsage', 'instanceTag'],
                            additionalProperties: false,
                        },
                        storeNewRelic: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                destinationAccount: {
                                    type: 'array',
                                    minItems: 0,
                                    items: {
                                        type: 'string',
                                    },
                                },
                                metric: {
                                    type: 'object',
                                    properties: {
                                        dynamic: {
                                            type: 'object',
                                            properties: {
                                                butlerMemoryUsage: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                butlerUptime: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['butlerMemoryUsage', 'butlerUptime'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['dynamic'],
                                    additionalProperties: false,
                                },
                                attribute: {
                                    type: 'object',
                                    properties: {
                                        static: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                        dynamic: {
                                            type: 'object',
                                            properties: {
                                                butlerVersion: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['butlerVersion'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['static', 'dynamic'],
                                },
                            },
                        },
                    },
                    required: [
                        'enable',
                        'frequency',
                        'logLevel',
                        'storeInInfluxdb',
                        'storeNewRelic',
                    ],
                    additionalProperties: false,
                },
                thirdPartyToolsCredentials: {
                    type: 'object',
                    properties: {
                        newRelic: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    accountName: { type: 'string' },
                                    insertApiKey: { type: 'string' },
                                    accountId: { type: 'string' },
                                },
                                required: ['accountName', 'insertApiKey', 'accountId'],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ['newRelic'],
                    additionalProperties: false,
                },
                qlikSenseEvents: {
                    type: 'object',
                    properties: {
                        influxdb: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                writeFrequency: { type: 'number' },
                            },
                            required: ['enable', 'writeFrequency'],
                            additionalProperties: false,
                        },
                        eventCount: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        measurementName: { type: 'string' },
                                        tags: {
                                            type: ['array', 'null'],
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                    },
                                    required: ['measurementName', 'tags'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['enable', 'influxdb'],
                            additionalProperties: false,
                        },
                        rejectedEventCount: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        measurementName: { type: 'string' },
                                    },
                                    required: ['measurementName'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['enable', 'influxdb'],
                            additionalProperties: false,
                        },
                    },
                    required: ['influxdb', 'eventCount', 'rejectedEventCount'],
                    additionalProperties: false,
                },
                userEvents: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        excludeUser: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    directory: { type: 'string' },
                                    userId: { type: 'string' },
                                },
                                required: ['directory', 'userId'],
                                additionalProperties: false,
                            },
                        },
                        udpServerConfig: {
                            type: 'object',
                            properties: {
                                serverHost: { type: 'string' },
                                portUserActivityEvents: { type: 'number' },
                            },
                            required: ['serverHost', 'portUserActivityEvents'],
                            additionalProperties: false,
                        },
                        tags: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    value: { type: 'string' },
                                },
                                required: ['name', 'value'],
                                additionalProperties: false,
                            },
                        },
                        sendToMQTT: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                postTo: {
                                    type: 'object',
                                    properties: {
                                        everythingTopic: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                topic: { type: 'string' },
                                            },
                                            required: ['enable', 'topic'],
                                            additionalProperties: false,
                                        },
                                        sessionStartTopic: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                topic: { type: 'string' },
                                            },
                                            required: ['enable', 'topic'],
                                            additionalProperties: false,
                                        },
                                        sessionStopTopic: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                topic: { type: 'string' },
                                            },
                                            required: ['enable', 'topic'],
                                            additionalProperties: false,
                                        },
                                        connectionOpenTopic: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                topic: { type: 'string' },
                                            },
                                            required: ['enable', 'topic'],
                                            additionalProperties: false,
                                        },
                                        connectionCloseTopic: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                topic: { type: 'string' },
                                            },
                                            required: ['enable', 'topic'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: [
                                        'everythingTopic',
                                        'sessionStartTopic',
                                        'sessionStopTopic',
                                        'connectionOpenTopic',
                                        'connectionCloseTopic',
                                    ],
                                    additionalProperties: false,
                                },
                            },
                            required: ['enable', 'postTo'],
                            additionalProperties: false,
                        },
                        sendToInfluxdb: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                            },
                            required: ['enable'],
                            additionalProperties: false,
                        },
                        sendToNewRelic: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                destinationAccount: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'string',
                                    },
                                },
                                scramble: { type: 'boolean' },
                            },
                            required: ['enable', 'destinationAccount', 'scramble'],
                            additionalProperties: false,
                        },
                    },
                    required: ['enable', 'excludeUser', 'udpServerConfig', 'tags'],
                    additionalProperties: false,
                },
                logEvents: {
                    type: 'object',
                    properties: {
                        udpServerConfig: {
                            type: 'object',
                            properties: {
                                serverHost: { type: 'string' },
                                portLogEvents: { type: 'number' },
                            },
                            required: ['serverHost', 'portLogEvents'],
                            additionalProperties: false,
                        },
                        tags: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    value: { type: 'string' },
                                },
                                required: ['name', 'value'],
                                additionalProperties: false,
                            },
                        },
                        source: {
                            type: 'object',
                            properties: {
                                engine: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                                proxy: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                                repository: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                                scheduler: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                                qixPerf: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['engine', 'proxy', 'repository', 'scheduler', 'qixPerf'],
                            additionalProperties: false,
                        },
                        categorise: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                rules: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'object',
                                        properties: {
                                            description: { type: 'string' },
                                            logLevel: {
                                                type: ['array'],
                                                items: {
                                                    type: 'string',
                                                    enum: [
                                                        'error',
                                                        'warn',
                                                        'info',
                                                        'verbose',
                                                        'debug',
                                                        'silly',
                                                    ],
                                                    transform: ['trim', 'toLowerCase'],
                                                },
                                                minItems: 1,
                                            },
                                            action: {
                                                type: 'string',
                                                enum: ['categorise', 'drop'],
                                                transform: ['trim', 'toLowerCase'],
                                            },
                                            category: {
                                                type: ['array'],
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        name: { type: 'string' },
                                                        value: { type: 'string' },
                                                    },
                                                    required: ['name', 'value'],
                                                    additionalProperties: false,
                                                },
                                                minItems: 1,
                                            },
                                            filter: {
                                                type: ['array'],
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        type: {
                                                            type: 'string',
                                                            enum: ['sw', 'ew', 'so'],
                                                            transform: ['trim', 'toLowerCase'],
                                                        },
                                                        value: { type: 'string' },
                                                    },
                                                    required: ['type', 'value'],
                                                    additionalProperties: false,
                                                },
                                                minItems: 1,
                                            },
                                        },
                                        required: [
                                            'description',
                                            'logLevel',
                                            'action',
                                            'category',
                                            'filter',
                                        ],
                                        additionalProperties: false,
                                    },
                                },
                                ruleDefault: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                        category: {
                                            type: ['array', 'null'],
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                    },
                                    required: ['enable', 'category'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['rules', 'ruleDefault'],
                            additionalProperties: false,
                        },
                        enginePerformanceMonitor: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                appNameLookup: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                    },
                                    required: ['enable'],
                                    additionalProperties: false,
                                },
                                trackRejectedEvents: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                        tags: {
                                            type: ['array', 'null'],
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                    },
                                    required: ['enable', 'tags'],
                                    additionalProperties: false,
                                },
                                monitorFilter: {
                                    type: 'object',
                                    properties: {
                                        allApps: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                appExclude: {
                                                    type: ['array', 'null'],
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            appId: { type: 'string' },
                                                            appName: { type: 'string' },
                                                        },
                                                        additionalProperties: false,
                                                    },
                                                },
                                                objectType: {
                                                    type: 'object',
                                                    properties: {
                                                        allObjectTypes: { type: 'boolean' },
                                                        allObjectTypesExclude: {
                                                            type: ['array', 'null'],
                                                            items: {
                                                                type: 'string',
                                                            },
                                                        },
                                                        someObjectTypesInclude: {
                                                            type: ['array', 'null'],
                                                            items: {
                                                                type: 'string',
                                                            },
                                                        },
                                                    },
                                                    required: [
                                                        'allObjectTypes',
                                                        'allObjectTypesExclude',
                                                        'someObjectTypesInclude',
                                                    ],
                                                    additionalProperties: false,
                                                },
                                                method: {
                                                    type: 'object',
                                                    properties: {
                                                        allMethods: { type: 'boolean' },
                                                        allMethodsExclude: {
                                                            type: ['array', 'null'],
                                                            items: {
                                                                type: 'string',
                                                            },
                                                        },
                                                        someMethodsInclude: {
                                                            type: ['array', 'null'],
                                                            items: {
                                                                type: 'string',
                                                            },
                                                        },
                                                    },
                                                    required: [
                                                        'allMethods',
                                                        'allMethodsExclude',
                                                        'someMethodsInclude',
                                                    ],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['enable', 'appExclude'],
                                            additionalProperties: false,
                                        },
                                        appSpecific: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                app: {
                                                    type: ['array', 'null'],
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            include: {
                                                                type: ['array', 'null'],
                                                                items: {
                                                                    type: 'object',
                                                                    properties: {
                                                                        appId: { type: 'string' },
                                                                        appName: { type: 'string' },
                                                                    },
                                                                    additionalProperties: false,
                                                                },
                                                            },
                                                            objectType: {
                                                                type: 'object',
                                                                properties: {
                                                                    allObjectTypes: {
                                                                        type: 'boolean',
                                                                    },
                                                                    allObjectTypesExclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                    someObjectTypesInclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                },
                                                                required: [
                                                                    'allObjectTypes',
                                                                    'allObjectTypesExclude',
                                                                    'someObjectTypesInclude',
                                                                ],
                                                                additionalProperties: false,
                                                            },
                                                            appObject: {
                                                                type: 'object',
                                                                properties: {
                                                                    allAppObjects: {
                                                                        type: 'boolean',
                                                                    },
                                                                    allAppObjectsExclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                    someAppObjectsInclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                },
                                                                required: [
                                                                    'allAppObjects',
                                                                    'allAppObjectsExclude',
                                                                    'someAppObjectsInclude',
                                                                ],
                                                                additionalProperties: false,
                                                            },
                                                            method: {
                                                                type: 'object',
                                                                properties: {
                                                                    allMethods: { type: 'boolean' },
                                                                    allMethodsExclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                    someMethodsInclude: {
                                                                        type: ['array', 'null'],
                                                                        items: {
                                                                            type: 'string',
                                                                        },
                                                                    },
                                                                },
                                                                required: [
                                                                    'allMethods',
                                                                    'allMethodsExclude',
                                                                    'someMethodsInclude',
                                                                ],
                                                                additionalProperties: false,
                                                            },
                                                        },
                                                        required: [
                                                            'include',
                                                            'objectType',
                                                            'appObject',
                                                            'method',
                                                        ],
                                                        additionalProperties: false,
                                                    },
                                                },
                                            },
                                            required: ['enable', 'app'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['allApps', 'appSpecific'],
                                    additionalProperties: false,
                                },
                            },
                            required: [
                                'enable',
                                'appNameLookup',
                                'trackRejectedEvents',
                                'monitorFilter',
                            ],
                            additionalProperties: false,
                        },
                        sendToMQTT: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                baseTopic: { type: 'string' },
                                postTo: {
                                    type: 'object',
                                    properties: {
                                        baseTopic: { type: 'boolean' },
                                        subsystemTopics: { type: 'boolean' },
                                    },
                                    required: ['baseTopic', 'subsystemTopics'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['enable', 'baseTopic', 'postTo'],
                            additionalProperties: false,
                        },
                        sendToInfluxdb: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                            },
                            required: ['enable'],
                            additionalProperties: false,
                        },
                        sendToNewRelic: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean' },
                                destinationAccount: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'string',
                                    },
                                },
                                source: {
                                    type: 'object',
                                    properties: {
                                        engine: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                logLevel: {
                                                    type: 'object',
                                                    properties: {
                                                        error: { type: 'boolean' },
                                                        warn: { type: 'boolean' },
                                                    },
                                                },
                                            },
                                            required: ['enable', 'logLevel'],
                                            additionalProperties: false,
                                        },
                                        proxy: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                logLevel: {
                                                    type: 'object',
                                                    properties: {
                                                        error: { type: 'boolean' },
                                                        warn: { type: 'boolean' },
                                                    },
                                                },
                                            },
                                            required: ['enable', 'logLevel'],
                                            additionalProperties: false,
                                        },
                                        repository: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                logLevel: {
                                                    type: 'object',
                                                    properties: {
                                                        error: { type: 'boolean' },
                                                        warn: { type: 'boolean' },
                                                    },
                                                },
                                            },
                                            required: ['enable', 'logLevel'],
                                            additionalProperties: false,
                                        },
                                        scheduler: {
                                            type: 'object',
                                            properties: {
                                                enable: { type: 'boolean' },
                                                logLevel: {
                                                    type: 'object',
                                                    properties: {
                                                        error: { type: 'boolean' },
                                                        warn: { type: 'boolean' },
                                                    },
                                                },
                                            },
                                            required: ['enable', 'logLevel'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['engine', 'proxy', 'repository', 'scheduler'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['enable', 'destinationAccount', 'source'],
                            additionalProperties: false,
                        },
                    },
                    required: ['udpServerConfig', 'tags', 'source', 'categorise'],
                    additionalProperties: false,
                },
                cert: {
                    type: 'object',
                    properties: {
                        clientCert: { type: 'string' },
                        clientCertKey: { type: 'string' },
                        clientCertCA: { type: 'string' },
                        clientCertPassphrase: {
                            type: ['string', 'null'],
                        },
                    },
                    required: ['clientCert', 'clientCertKey', 'clientCertCA'],
                    additionalProperties: false,
                },
                mqttConfig: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        brokerHost: { type: 'string' },
                        brokerPort: { type: 'number' },
                        baseTopic: { type: 'string' },
                    },
                    required: ['enable', 'brokerHost', 'brokerPort', 'baseTopic'],
                    additionalProperties: false,
                },
                newRelic: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        event: {
                            type: 'object',
                            properties: {
                                url: { type: 'string' },
                                header: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            value: { type: 'string' },
                                        },
                                        required: ['name', 'value'],
                                        additionalProperties: false,
                                    },
                                },
                                attribute: {
                                    type: 'object',
                                    properties: {
                                        static: {
                                            type: ['array', 'null'],
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                        dynamic: {
                                            type: 'object',
                                            properties: {
                                                butlerSosVersion: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['butlerSosVersion'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['static', 'dynamic'],
                                },
                            },
                            required: ['url', 'header', 'attribute'],
                            additionalProperties: false,
                        },
                        metric: {
                            type: 'object',
                            properties: {
                                destinationAccount: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'string',
                                    },
                                },
                                url: { type: 'string' },
                                header: {
                                    type: ['array', 'null'],
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            value: { type: 'string' },
                                        },
                                        required: ['name', 'value'],
                                        additionalProperties: false,
                                    },
                                },
                                dynamic: {
                                    type: 'object',
                                    properties: {
                                        engine: {
                                            type: 'object',
                                            properties: {
                                                memory: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                cpu: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                calls: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                selections: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                sessions: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                users: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                saturated: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: [
                                                'memory',
                                                'cpu',
                                                'calls',
                                                'selections',
                                                'sessions',
                                                'users',
                                                'saturated',
                                            ],
                                            additionalProperties: false,
                                        },
                                        apps: {
                                            type: 'object',
                                            properties: {
                                                docCount: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                activeDocs: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                loadedDocs: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                                inMemoryDocs: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: [
                                                'docCount',
                                                'activeDocs',
                                                'loadedDocs',
                                                'inMemoryDocs',
                                            ],
                                            additionalProperties: false,
                                        },
                                        cache: {
                                            type: 'object',
                                            properties: {
                                                cache: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['cache'],
                                            additionalProperties: false,
                                        },
                                        proxy: {
                                            type: 'object',
                                            properties: {
                                                sessions: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['sessions'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['engine', 'apps', 'cache', 'proxy'],
                                    additionalProperties: false,
                                },
                                attribute: {
                                    type: 'object',
                                    properties: {
                                        static: {
                                            type: ['array', 'null'],
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    value: { type: 'string' },
                                                },
                                                required: ['name', 'value'],
                                                additionalProperties: false,
                                            },
                                        },
                                        dynamic: {
                                            type: 'object',
                                            properties: {
                                                butlerSosVersion: {
                                                    type: 'object',
                                                    properties: {
                                                        enable: { type: 'boolean' },
                                                    },
                                                    required: ['enable'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ['butlerSosVersion'],
                                            additionalProperties: false,
                                        },
                                    },
                                    required: ['static', 'dynamic'],
                                },
                            },
                            required: [
                                'destinationAccount',
                                'url',
                                'header',
                                'dynamic',
                                'attribute',
                            ],
                            additionalProperties: false,
                        },
                    },
                    required: ['enable', 'event', 'metric'],
                    additionalProperties: false,
                },
                prometheus: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        host: { type: 'string' },
                        port: { type: 'number' },
                    },
                    required: ['enable', 'port'],
                    additionalProperties: false,
                },
                influxdbConfig: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        host: { type: 'string' },
                        port: { type: 'number' },
                        version: { type: 'number' },
                        v2Config: {
                            type: 'object',
                            properties: {
                                org: { type: 'string' },
                                bucket: { type: 'string' },
                                description: { type: 'string' },
                                token: { type: 'string' },
                                retentionDuration: { type: 'string' },
                            },
                            required: [
                                'org',
                                'bucket',
                                'description',
                                'token',
                                'retentionDuration',
                            ],
                            additionalProperties: false,
                        },
                        v1Config: {
                            type: 'object',
                            properties: {
                                auth: {
                                    type: 'object',
                                    properties: {
                                        enable: { type: 'boolean' },
                                        username: { type: 'string' },
                                        password: { type: 'string' },
                                    },
                                    required: ['enable', 'username', 'password'],
                                    additionalProperties: false,
                                },
                                dbName: { type: 'string' },
                                retentionPolicy: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        duration: { type: 'string' },
                                    },
                                    required: ['name', 'duration'],
                                    additionalProperties: false,
                                },
                            },
                            required: ['auth', 'dbName', 'retentionPolicy'],
                            additionalProperties: false,
                        },
                        includeFields: {
                            type: 'object',
                            properties: {
                                activeDocs: { type: 'boolean' },
                                loadedDocs: { type: 'boolean' },
                                inMemoryDocs: { type: 'boolean' },
                            },
                            required: ['activeDocs', 'loadedDocs', 'inMemoryDocs'],
                            additionalProperties: false,
                        },
                    },
                    required: [
                        'enable',
                        'host',
                        'port',
                        'version',
                        'v2Config',
                        'v1Config',
                        'includeFields',
                    ],
                    additionalProperties: false,
                },
                appNames: {
                    type: 'object',
                    properties: {
                        enableAppNameExtract: { type: 'boolean' },
                        extractInterval: { type: 'number' },
                        hostIP: { type: 'string' },
                    },
                    required: ['enableAppNameExtract', 'extractInterval', 'hostIP'],
                    additionalProperties: false,
                },
                userSessions: {
                    type: 'object',
                    properties: {
                        enableSessionExtract: { type: 'boolean' },
                        pollingInterval: { type: 'number' },
                        excludeUser: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    directory: { type: 'string' },
                                    userId: { type: 'string' },
                                },
                                required: ['directory', 'userId'],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ['enableSessionExtract', 'pollingInterval', 'excludeUser'],
                    additionalProperties: false,
                },
                serversToMonitor: {
                    type: 'object',
                    properties: {
                        pollingInterval: { type: 'number' },
                        rejectUnauthorized: { type: 'boolean' },
                        serverTagsDefinition: {
                            type: ['array', 'null'],
                            items: {
                                type: 'string',
                            },
                        },
                        servers: {
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: {
                                    host: { type: 'string' },
                                    serverName: { type: 'string' },
                                    serverDescription: { type: 'string' },
                                    logDbHost: { type: 'string' },
                                    userSessions: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                            host: { type: 'string' },
                                            virtualProxies: {
                                                type: ['array'],
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        virtualProxy: { type: 'string' },
                                                    },
                                                    required: ['virtualProxy'],
                                                    additionalProperties: false,
                                                },
                                                minItems: 1,
                                            },
                                        },
                                        required: ['enable', 'host', 'virtualProxies'],
                                        additionalProperties: false,
                                    },
                                    serverTags: {
                                        type: ['object', 'null'],
                                        properties: {},
                                        required: [],
                                        additionalProperties: true,
                                    },
                                    headers: {
                                        type: ['object', 'null'],
                                        properties: {},
                                        required: [],
                                        additionalProperties: true,
                                    },
                                },
                                required: [
                                    'host',
                                    'serverName',
                                    'serverDescription',
                                    'logDbHost',
                                    'userSessions',
                                    'serverTags',
                                    'headers',
                                ],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: [
                        'pollingInterval',
                        'rejectUnauthorized',
                        'serverTagsDefinition',
                        'servers',
                    ],
                    additionalProperties: false,
                },
            },
            required: [
                'logLevel',
                'fileLogging',
                'logDirectory',
                'anonTelemetry',
                'configVisualisation',
                'heartbeat',
                'dockerHealthCheck',
                'uptimeMonitor',
                'thirdPartyToolsCredentials',
                'qlikSenseEvents',
                'userEvents',
                'logEvents',
                'cert',
                'mqttConfig',
                'newRelic',
                'prometheus',
                'influxdbConfig',
                'appNames',
                'userSessions',
                'serversToMonitor',
            ],
            additionalProperties: true,
        },
    },
    required: ['Butler-SOS'],
    additionalProperties: false,
};
