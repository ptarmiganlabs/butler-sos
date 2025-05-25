/**
 * Schema definition for Butler SOS configuration file validation.
 *
 * This file now imports the modular schema from the config-schemas subdirectory.
 * The large monolithic schema has been refactored into smaller, focused modules
 * for better maintainability and organization.
 *
 * The modular structure includes:
 * - basic-settings.js - Core application settings
 * - monitoring-services.js - Health checks and monitoring
 * - credentials.js - Security and authentication
 * - qlik-sense-events.js - Qlik Sense event configuration
 * - user-events.js - User activity tracking
 * - log-events.js - Log processing and categorization
 * - destinations.js - Output destinations (MQTT, New Relic, etc.)
 * - app-sessions.js - Application and session management
 * - servers.js - Server monitoring configuration
 *
 * @type {object} JSON Schema object for Butler SOS configuration validation
 */

// Import the modular schema from the config-schemas subdirectory
import configFileSchema from './config-schemas/index.js';

// Export for compatibility with existing code
export default configFileSchema;
