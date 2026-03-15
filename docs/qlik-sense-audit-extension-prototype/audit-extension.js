/**
 * Butler SOS Audit Extension
 *
 * Main extension module that coordinates monitoring and event transmission
 *
 * @version 1.0.0
 * @author Ptarmigan Labs
 * @license MIT
 */

define([
    'qlik',
    'jquery',
    './lib/event-buffer',
    './lib/selection-monitor',
    './lib/transport',
], function (qlik, $, EventBuffer, SelectionMonitor, Transport) {
    'use strict';

    return {
        /**
         * Extension properties definition
         */
        definition: {
            type: 'items',
            component: 'accordion',
            items: {
                settings: {
                    uses: 'settings',
                    items: {
                        butlerSOSConfig: {
                            type: 'items',
                            label: 'Butler SOS Configuration',
                            items: {
                                butlerSOSEndpoint: {
                                    ref: 'butlerSOS.endpoint',
                                    label: 'Butler SOS Endpoint',
                                    type: 'string',
                                    defaultValue: 'https://butler-sos:8181/api/v1/audit/events',
                                    expression: 'optional',
                                },
                                apiToken: {
                                    ref: 'butlerSOS.apiToken',
                                    label: 'API Token',
                                    type: 'string',
                                    defaultValue: '',
                                    expression: 'optional',
                                },
                                batchIntervalMs: {
                                    ref: 'butlerSOS.batchIntervalMs',
                                    label: 'Batch Interval (ms)',
                                    type: 'number',
                                    defaultValue: 1000,
                                    expression: 'optional',
                                },
                            },
                        },
                        trackingConfig: {
                            type: 'items',
                            label: 'Tracking Configuration',
                            items: {
                                trackSelections: {
                                    ref: 'tracking.selections',
                                    label: 'Track Selections',
                                    type: 'boolean',
                                    defaultValue: true,
                                },
                                captureValues: {
                                    ref: 'tracking.captureValues',
                                    label: 'Capture Selected Values',
                                    type: 'boolean',
                                    defaultValue: true,
                                },
                                maxValuesPerField: {
                                    ref: 'tracking.maxValuesPerField',
                                    label: 'Max Values Per Field',
                                    type: 'number',
                                    defaultValue: 100,
                                },
                                trackObjects: {
                                    ref: 'tracking.objects',
                                    label: 'Track Object Rendering',
                                    type: 'boolean',
                                    defaultValue: false,
                                },
                                objectsToTrack: {
                                    ref: 'tracking.objectIds',
                                    label: 'Object IDs to Track (comma-separated, empty = all)',
                                    type: 'string',
                                    defaultValue: '',
                                    expression: 'optional',
                                },
                            },
                        },
                    },
                },
            },
        },

        /**
         * Extension support options
         */
        support: {
            snapshot: false,
            export: false,
            exportData: false,
        },

        /**
         * Main paint function - initializes and starts monitoring
         *
         * @param {jQuery} $element - The jQuery element to render into
         * @param {object} layout - The layout object containing configuration
         */
        paint: function ($element, layout) {
            var app = qlik.currApp();

            // Extract configuration
            var config = {
                endpoint: (layout.butlerSOS && layout.butlerSOS.endpoint) || '',
                apiToken: (layout.butlerSOS && layout.butlerSOS.apiToken) || '',
                batchIntervalMs: (layout.butlerSOS && layout.butlerSOS.batchIntervalMs) || 1000,
                trackSelections: layout.tracking && layout.tracking.selections !== false,
                captureValues: layout.tracking && layout.tracking.captureValues !== false,
                maxValuesPerField: (layout.tracking && layout.tracking.maxValuesPerField) || 100,
                trackObjects: layout.tracking && layout.tracking.objects === true,
                objectIds:
                    layout.tracking && layout.tracking.objectIds
                        ? layout.tracking.objectIds.split(',').map(function (s) {
                              return s.trim();
                          })
                        : [],
            };

            // Validate configuration
            if (!config.endpoint) {
                $element.html(
                    '<div style="padding: 20px; color: #c00;">' +
                        '<h3>Butler SOS Audit Extension</h3>' +
                        '<p><strong>Configuration Error:</strong> Butler SOS endpoint not configured</p>' +
                        '<p>Please configure the endpoint in the extension properties.</p>' +
                        '</div>'
                );
                return;
            }

            // Initialize components
            var eventBuffer = new EventBuffer(config.batchIntervalMs);
            var transport = new Transport(config.endpoint, config.apiToken);
            var selectionMonitor = null;

            // Start selection monitoring if enabled
            if (config.trackSelections) {
                selectionMonitor = new SelectionMonitor(app, config, eventBuffer);
                selectionMonitor.start();
            }

            // Set up event flushing
            eventBuffer.onFlush(function (events) {
                if (events.length === 0) return;

                transport
                    .send(events)
                    .then(function () {
                        console.log('Butler SOS: Successfully sent ' + events.length + ' events');
                    })
                    .catch(function (error) {
                        console.error('Butler SOS: Failed to send events:', error);
                    });
            });

            // Start the batch timer
            eventBuffer.start();

            // Display status in extension tile
            var statusHtml =
                '<div style="padding: 20px; font-family: Arial, sans-serif;">' +
                '<h3 style="margin-top: 0;">Butler SOS Audit Extension</h3>' +
                '<p>Status: <span style="color: green; font-weight: bold;">Active</span></p>' +
                '<p>Tracking: ' +
                (config.trackSelections
                    ? '<span style="color: #0078d4;">✓ Selections</span> '
                    : '') +
                (config.trackObjects ? '<span style="color: #0078d4;">✓ Objects</span>' : '') +
                '</p>' +
                '<p>Events buffered: <span id="event-count" style="font-weight: bold;">0</span></p>' +
                '<p style="font-size: 0.9em; color: #666;">Batch interval: ' +
                config.batchIntervalMs +
                'ms</p>' +
                '</div>';

            $element.html(statusHtml);

            // Update event count display
            eventBuffer.onAdd(function (count) {
                $('#event-count').text(count);
            });

            // Cleanup on destruction
            this.destroyMonitoring = function () {
                if (eventBuffer) {
                    eventBuffer.stop();
                }
                if (selectionMonitor) {
                    selectionMonitor.stop();
                }
            };
        },

        /**
         * Called when extension is destroyed
         */
        destroy: function () {
            if (this.destroyMonitoring) {
                this.destroyMonitoring();
            }
        },
    };
});
