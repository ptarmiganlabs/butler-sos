/**
 * Schema definition for Butler SOS basic application settings.
 *
 * This schema covers the fundamental application configuration options:
 * - Log level and file logging settings
 * - Anonymous telemetry settings
 * - System information gathering settings
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
    /**
     * System information gathering configuration.
     *
     * When enabled (default), Butler SOS uses the systeminformation npm package
     * to collect detailed system information. This package executes certain OS commands
     * on Windows that may trigger security alerts in enterprise environments:
     * - `cmd.exe /d /s /c \chcp` (code page information)
     * - `netstat -r` (routing table)
     * - `cmd.exe /d /s /c \echo %COMPUTERNAME%.%USERDNSDOMAIN%` (computer/domain names)
     *
     * Set to false in security-sensitive environments to disable detailed system
     * information gathering and prevent these OS command executions.
     */
    systemInfo: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
        },
        required: ['enable'],
        additionalProperties: false,
    },
};
