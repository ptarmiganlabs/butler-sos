/**
 * Schema definition for Butler SOS log events configuration.
 *
 * This schema covers configuration for handling Qlik Sense log events:
 * - UDP server configuration for receiving log events
 * - Log source configuration (engine, proxy, repository, scheduler, QIX performance)
 * - Log categorization rules and filters
 * - Engine performance monitoring with complex filtering options
 * - MQTT, InfluxDB, and New Relic integration for log forwarding
 *
 * @type {object} JSON Schema object for log events validation
 */
export const logEventsSchema = {
    logEvents: {
        type: 'object',
        properties: {
            udpServerConfig: {
                type: 'object',
                properties: {
                    serverHost: {
                        type: 'string',
                        format: 'hostname',
                    },
                    portLogEvents: { type: 'number' },
                    messageQueue: {
                        type: 'object',
                        properties: {
                            maxConcurrent: { type: 'number', minimum: 1 },
                            maxSize: { type: 'number', minimum: 1 },
                            dropStrategy: {
                                type: 'string',
                                enum: ['oldest', 'newest'],
                            },
                        },
                        required: ['maxConcurrent', 'maxSize', 'dropStrategy'],
                        additionalProperties: false,
                    },
                    rateLimit: {
                        type: 'object',
                        properties: {
                            enable: { type: 'boolean' },
                            maxMessagesPerMinute: { type: 'number', minimum: 1 },
                            violationLogThrottle: { type: 'number', minimum: 1 },
                        },
                        required: ['enable', 'maxMessagesPerMinute', 'violationLogThrottle'],
                        additionalProperties: false,
                    },
                    maxMessageSize: { type: 'number', minimum: 1, maximum: 65507 },
                    backpressure: {
                        type: 'object',
                        properties: {
                            threshold: { type: 'number', minimum: 1, maximum: 100 },
                        },
                        required: ['threshold'],
                        additionalProperties: false,
                    },
                },
                required: [
                    'serverHost',
                    'portLogEvents',
                    'messageQueue',
                    'rateLimit',
                    'maxMessageSize',
                    'backpressure',
                ],
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
                            required: ['description', 'logLevel', 'action', 'category', 'filter'],
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
                required: ['enable', 'appNameLookup', 'trackRejectedEvents', 'monitorFilter'],
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
};
