/**
 * Schema definition for Butler SOS Qlik Sense events configuration.
 *
 * This schema covers configuration for handling Qlik Sense events:
 * - Event processing settings
 * - Event counting and rejected event tracking
 * - InfluxDB integration for event storage
 *
 * @type {object} JSON Schema object for Qlik Sense events validation
 */
export const qlikSenseEventsSchema = {
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
};
