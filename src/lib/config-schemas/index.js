// Main configuration schema for Butler-SOS
// This file combines all modular schema definitions into the complete Butler-SOS configuration schema

import { basicSettingsSchema } from './basic-settings.js';
import { monitoringServicesSchema } from './monitoring-services.js';
import { credentialsSchema } from './credentials.js';
import { qlikSenseEventsSchema } from './qlik-sense-events.js';
import { userEventsSchema } from './user-events.js';
import { logEventsSchema } from './log-events.js';
import { destinationsSchema } from './destinations.js';
import { appSessionsSchema } from './app-sessions.js';
import { serversSchema } from './servers.js';

// Complete Butler-SOS configuration schema
const configFileSchema = {
    type: 'object',
    properties: {
        'Butler-SOS': {
            type: 'object',
            properties: {
                // Basic application settings
                ...basicSettingsSchema,

                // Monitoring and health check services
                ...monitoringServicesSchema,

                // Security and credentials
                ...credentialsSchema,

                // Event processing
                ...qlikSenseEventsSchema,
                ...userEventsSchema,
                ...logEventsSchema,

                // Destination systems
                ...destinationsSchema,

                // Application and session management
                ...appSessionsSchema,

                // Server monitoring
                ...serversSchema,
            },
            required: [
                'logLevel',
                'fileLogging',
                'logDirectory',
                'anonTelemetry',
                'systemInfo',
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

export default configFileSchema;
