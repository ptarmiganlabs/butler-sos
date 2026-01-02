/**
 * Transport Layer
 *
 * Handles HTTP communication with Butler SOS audit endpoint
 *
 * @module lib/transport
 */

define(['jquery'], function ($) {
    'use strict';

    /**
     * Creates a new Transport instance
     *
     * @class
     * @param {string} endpoint - Butler SOS endpoint URL
     * @param {string} apiToken - API authentication token
     */
    function Transport(endpoint, apiToken) {
        this.endpoint = endpoint;
        this.apiToken = apiToken;
    }

    /**
     * Send events to Butler SOS
     *
     * @param {Array<object>} events - Array of events to send
     * @returns {Promise} Promise that resolves when send completes
     */
    Transport.prototype.send = function (events) {
        var self = this;

        if (!this.endpoint || events.length === 0) {
            return Promise.resolve();
        }

        var payload = this.buildPayload(events);

        return new Promise(function (resolve, reject) {
            $.ajax({
                url: self.endpoint,
                method: 'POST',
                contentType: 'application/json',
                headers: self.getHeaders(),
                data: JSON.stringify(payload),
                timeout: 5000,
                success: function (response) {
                    resolve(response);
                },
                error: function (xhr, status, error) {
                    reject(new Error('HTTP ' + xhr.status + ': ' + error));
                },
            });
        });
    };

    /**
     * Build payload with event metadata
     *
     * @param {Array<object>} events - Events to include
     * @returns {object} Complete payload object
     */
    Transport.prototype.buildPayload = function (events) {
        var app = typeof qlik !== 'undefined' ? qlik.currApp() : null;
        var global = typeof qlik !== 'undefined' ? qlik.getGlobal() : null;

        // Get user info
        var userInfo = null;
        if (global && global.session) {
            try {
                userInfo = global.session.getUserInfo();
            } catch (e) {
                // getUserInfo might not be available
                console.warn('Butler SOS: Could not get user info:', e);
            }
        }

        // Build source information
        var source = {
            extensionVersion: '1.0.0',
            appId: app ? app.id : 'unknown',
            sessionId: app && app.sessionId ? app.sessionId : 'unknown',
        };

        // Add user info if available
        if (userInfo) {
            source.userId = userInfo.qUserId || 'unknown';
            source.userDirectory = userInfo.qUserDirectory || 'unknown';
            source.userName = userInfo.qUserName || 'unknown';
        } else {
            source.userId = 'unknown';
            source.userDirectory = 'unknown';
            source.userName = 'unknown';
        }

        // Build client information
        var client = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };

        // Add screen resolution if available
        if (typeof screen !== 'undefined') {
            client.screenResolution = screen.width + 'x' + screen.height;
        }

        // Parse user agent for browser/OS info
        var ua = this.parseUserAgent(navigator.userAgent);
        if (ua.browser) {
            client.browser = ua.browser;
        }
        if (ua.browserVersion) {
            client.browserVersion = ua.browserVersion;
        }
        if (ua.os) {
            client.os = ua.os;
        }

        return {
            apiVersion: '1.0',
            source: source,
            client: client,
            events: events,
        };
    };

    /**
     * Get HTTP headers for request
     *
     * @returns {object} Headers object
     */
    Transport.prototype.getHeaders = function () {
        var headers = {};

        if (this.apiToken) {
            headers['X-Butler-SOS-Token'] = this.apiToken;
        }

        return headers;
    };

    /**
     * Parse user agent string (basic parsing)
     *
     * @param {string} ua - User agent string
     * @returns {object} Parsed information
     */
    Transport.prototype.parseUserAgent = function (ua) {
        var result = {};

        // Detect browser
        if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
            result.browser = 'Chrome';
            var match = ua.match(/Chrome\/([0-9.]+)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.indexOf('Edg') > -1) {
            result.browser = 'Edge';
            var match = ua.match(/Edg\/([0-9.]+)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.indexOf('Firefox') > -1) {
            result.browser = 'Firefox';
            var match = ua.match(/Firefox\/([0-9.]+)/);
            if (match) result.browserVersion = match[1];
        } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
            result.browser = 'Safari';
            var match = ua.match(/Version\/([0-9.]+)/);
            if (match) result.browserVersion = match[1];
        }

        // Detect OS
        if (ua.indexOf('Windows') > -1) {
            result.os = 'Windows';
            if (ua.indexOf('Windows NT 10.0') > -1) result.osVersion = '10';
            else if (ua.indexOf('Windows NT 6.3') > -1) result.osVersion = '8.1';
            else if (ua.indexOf('Windows NT 6.2') > -1) result.osVersion = '8';
            else if (ua.indexOf('Windows NT 6.1') > -1) result.osVersion = '7';
        } else if (ua.indexOf('Mac') > -1) {
            result.os = 'macOS';
        } else if (ua.indexOf('Linux') > -1) {
            result.os = 'Linux';
        } else if (ua.indexOf('iPad') > -1 || ua.indexOf('iPhone') > -1) {
            result.os = 'iOS';
        } else if (ua.indexOf('Android') > -1) {
            result.os = 'Android';
        }

        return result;
    };

    return Transport;
});
