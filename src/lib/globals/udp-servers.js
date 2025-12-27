import dgram from 'dgram';
import { UdpQueueManager } from '../udp-queue-manager.js';
import { UdpEvents } from '../udp-event.js';
import { ErrorTracker, setupErrorCounterReset } from '../error-tracker.js';

/**
 * Initializes UDP servers, queue managers, and error tracking.
 *
 * @param {object} settings - The settings object to populate
 */
export function initUdp(settings) {
    // ------------------------------------
    // User activity UDP server
    settings.udpServerUserActivity = {};

    try {
        settings.udpServerUserActivity.host = settings.config.get(
            'Butler-SOS.userEvents.udpServerConfig.serverHost'
        );

        // Prepare to listen on port X for incoming UDP connections regarding user activity events
        settings.udpServerUserActivity.socket = dgram.createSocket({
            type: 'udp4',
            reuseAddr: false,
        });

        settings.udpServerUserActivity.portUserActivity = settings.config.get(
            'Butler-SOS.userEvents.udpServerConfig.portUserActivityEvents'
        );
    } catch (err) {
        settings.logger.error(
            `CONFIG: Setting up UDP user activity listener: ${settings.getErrorMessage(err)}`
        );
    }

    // ------------------------------------
    // Log events UDP server
    settings.udpServerLogEvents = {};

    try {
        settings.udpServerLogEvents.host = settings.config.get(
            'Butler-SOS.logEvents.udpServerConfig.serverHost'
        );

        // Prepare to listen on port X for incoming UDP connections regarding user activity events
        settings.udpServerLogEvents.socket = dgram.createSocket({
            type: 'udp4',
            reuseAddr: false,
        });

        settings.udpServerLogEvents.port = settings.config.get(
            'Butler-SOS.logEvents.udpServerConfig.portLogEvents'
        );
    } catch (err) {
        settings.logger.error(
            `CONFIG: Setting up UDP log events listener: ${settings.getErrorMessage(err)}`
        );
    }

    // ------------------------------------
    // Initialize UDP queue managers
    try {
        // User activity queue manager
        const userActivityQueueConfig = {
            messageQueue: settings.config.get('Butler-SOS.userEvents.udpServerConfig.messageQueue'),
            rateLimit: settings.config.get('Butler-SOS.userEvents.udpServerConfig.rateLimit'),
            maxMessageSize: settings.config.get(
                'Butler-SOS.userEvents.udpServerConfig.maxMessageSize'
            ),
        };
        settings.udpQueueManagerUserActivity = new UdpQueueManager(
            userActivityQueueConfig,
            settings.logger,
            'user_events'
        );

        // Log events queue manager
        const logEventsQueueConfig = {
            messageQueue: settings.config.get('Butler-SOS.logEvents.udpServerConfig.messageQueue'),
            rateLimit: settings.config.get('Butler-SOS.logEvents.udpServerConfig.rateLimit'),
            maxMessageSize: settings.config.get(
                'Butler-SOS.logEvents.udpServerConfig.maxMessageSize'
            ),
        };
        settings.udpQueueManagerLogEvents = new UdpQueueManager(
            logEventsQueueConfig,
            settings.logger,
            'log_events'
        );

        // Audit events queue manager (HTTP ingest)
        settings.auditEventsQueueManager = null;
        if (
            settings.config.has('Butler-SOS.auditEvents.enable') &&
            settings.config.get('Butler-SOS.auditEvents.enable') === true
        ) {
            const auditEventsQueueConfig = {
                messageQueue: settings.config.get('Butler-SOS.auditEvents.queue.messageQueue'),
                rateLimit: settings.config.get('Butler-SOS.auditEvents.queue.rateLimit'),
            };
            settings.auditEventsQueueManager = new UdpQueueManager(
                auditEventsQueueConfig,
                settings.logger,
                'audit_events'
            );
        }

        settings.logger.info('CONFIG: UDP queue managers initialized');
    } catch (err) {
        settings.logger.error(
            `CONFIG: Error initializing UDP queue managers: ${settings.getErrorMessage(err)}`
        );
    }

    // ------------------------------------
    // Track user events and log event counts
    if (settings.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
        settings.udpEvents = new UdpEvents(settings.logger);
    } else {
        settings.udpEvents = null;
    }

    // ------------------------------------
    // Track rejected user and log events
    if (settings.config.get('Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') === true) {
        settings.rejectedEvents = new UdpEvents(settings.logger);
    } else {
        settings.rejectedEvents = null;
    }

    // ------------------------------------
    // Track API error counts
    settings.errorTracker = new ErrorTracker(settings.logger);
    settings.logger.info('ERROR TRACKER: Initialized error tracking with daily UTC reset');

    // Setup midnight UTC reset timer for error counters
    setupErrorCounterReset();
}
