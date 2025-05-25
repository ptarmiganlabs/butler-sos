/**
 * Schema definition for Butler SOS basic application settings.
 *
 * This schema covers the fundamental application configuration options:
 * - Log level and file logging settings
 * - Anonymous telemetry settings
 *
 * @type {object} JSON Schema object for basic settings validation
 */
export const basicSettingsSchema = {
    logLevel: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
        transform: ['trim'],
    },
    fileLogging: { type: 'boolean' },
    logDirectory: { type: 'string' },
    anonTelemetry: { type: 'boolean' },
};
