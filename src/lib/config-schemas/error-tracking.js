// Error tracking configuration schema for Butler-SOS
// Controls in-memory error counting, daily console summary logging,
// and optional per-error InfluxDB writes.

export const errorTrackingSchema = {
    errorTracking: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            logSummary: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                },
                required: ['enable'],
                additionalProperties: false,
            },
            influxdb: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                    measurementName: { type: 'string' },
                },
                required: ['enable', 'measurementName'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'logSummary', 'influxdb'],
        additionalProperties: false,
    },
};
