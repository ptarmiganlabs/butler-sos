/**
 * Tests for qlik-sense-events schema validation
 *
 * This test suite validates the Qlik Sense events configuration schema,
 * including event processing settings, event counting, and InfluxDB integration.
 */

import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { qlikSenseEventsSchema } from '../qlik-sense-events.js';

describe('Qlik Sense Events Schema', () => {
    let ajv;

    beforeEach(() => {
        ajv = new Ajv({ strict: false, allErrors: true });
        addFormats(ajv);
    });

    describe('Schema Structure', () => {
        it('should be a valid JSON schema object', () => {
            expect(qlikSenseEventsSchema).toBeDefined();
            expect(typeof qlikSenseEventsSchema).toBe('object');
            expect(qlikSenseEventsSchema.qlikSenseEvents).toBeDefined();
            expect(qlikSenseEventsSchema.qlikSenseEvents.type).toBe('object');
        });

        it('should have required properties defined', () => {
            const schema = qlikSenseEventsSchema.qlikSenseEvents;
            expect(schema.required).toEqual(['influxdb', 'eventCount', 'rejectedEventCount']);
            expect(schema.additionalProperties).toBe(false);
        });
    });

    describe('InfluxDB Configuration', () => {
        it('should accept valid influxdb configuration', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents.properties.influxdb);

            const validConfig = {
                enable: true,
                writeFrequency: 5000,
            };

            expect(validate(validConfig)).toBe(true);
        });

        it('should reject influxdb config missing required fields', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents.properties.influxdb);

            const invalidConfig = {
                enable: true,
                // Missing writeFrequency
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'writeFrequency' },
                })
            );
        });

        it('should reject influxdb config with wrong types', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents.properties.influxdb);

            const invalidConfig = {
                enable: 'true', // Should be boolean
                writeFrequency: '5000', // Should be number
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        it('should reject influxdb config with additional properties', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents.properties.influxdb);

            const invalidConfig = {
                enable: true,
                writeFrequency: 5000,
                extraProperty: 'not allowed',
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'additionalProperties',
                })
            );
        });
    });

    describe('Event Count Configuration', () => {
        it('should accept valid eventCount configuration', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const validConfig = {
                enable: true,
                influxdb: {
                    measurementName: 'qlik_sense_events',
                    tags: [
                        { name: 'host', value: 'qlik-server' },
                        { name: 'environment', value: 'production' },
                    ],
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        it('should accept eventCount with null tags', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const validConfig = {
                enable: false,
                influxdb: {
                    measurementName: 'qlik_sense_events',
                    tags: null,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        it('should reject eventCount config missing required fields', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const invalidConfig = {
                enable: true,
                // Missing influxdb
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'influxdb' },
                })
            );
        });

        it('should reject eventCount influxdb config missing measurementName', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const invalidConfig = {
                enable: true,
                influxdb: {
                    // Missing measurementName
                    tags: [],
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        it('should reject invalid tag structure', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const invalidConfig = {
                enable: true,
                influxdb: {
                    measurementName: 'qlik_sense_events',
                    tags: [
                        { name: 'host' }, // Missing value
                    ],
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        it('should reject eventCount with additional properties', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.eventCount
            );

            const invalidConfig = {
                enable: true,
                influxdb: {
                    measurementName: 'qlik_sense_events',
                    tags: [],
                    extraProperty: 'not allowed',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    describe('Rejected Event Count Configuration', () => {
        it('should accept valid rejectedEventCount configuration', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.rejectedEventCount
            );

            const validConfig = {
                enable: true,
                influxdb: {
                    measurementName: 'qlik_sense_rejected_events',
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        it('should reject rejectedEventCount config missing required fields', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.rejectedEventCount
            );

            const invalidConfig = {
                enable: true,
                // Missing influxdb
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'influxdb' },
                })
            );
        });

        it('should reject rejectedEventCount influxdb missing measurementName', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.rejectedEventCount
            );

            const invalidConfig = {
                enable: true,
                influxdb: {
                    // Missing measurementName
                },
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'measurementName' },
                })
            );
        });

        it('should reject rejectedEventCount with additional properties', () => {
            const validate = ajv.compile(
                qlikSenseEventsSchema.qlikSenseEvents.properties.rejectedEventCount
            );

            const invalidConfig = {
                enable: true,
                influxdb: {
                    measurementName: 'qlik_sense_rejected_events',
                    extraProperty: 'not allowed',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'additionalProperties',
                })
            );
        });
    });

    describe('Complete Qlik Sense Events Configuration', () => {
        it('should accept valid complete configuration', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents);

            const validConfig = {
                influxdb: {
                    enable: true,
                    writeFrequency: 5000,
                },
                eventCount: {
                    enable: true,
                    influxdb: {
                        measurementName: 'qlik_sense_events',
                        tags: [{ name: 'host', value: 'qlik-server' }],
                    },
                },
                rejectedEventCount: {
                    enable: false,
                    influxdb: {
                        measurementName: 'qlik_sense_rejected_events',
                    },
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        it('should reject configuration missing required sections', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents);

            const invalidConfig = {
                influxdb: {
                    enable: true,
                    writeFrequency: 5000,
                },
                eventCount: {
                    enable: true,
                    influxdb: {
                        measurementName: 'qlik_sense_events',
                        tags: [],
                    },
                },
                // Missing rejectedEventCount
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'rejectedEventCount' },
                })
            );
        });

        it('should reject configuration with additional properties', () => {
            const validate = ajv.compile(qlikSenseEventsSchema.qlikSenseEvents);

            const invalidConfig = {
                influxdb: {
                    enable: true,
                    writeFrequency: 5000,
                },
                eventCount: {
                    enable: true,
                    influxdb: {
                        measurementName: 'qlik_sense_events',
                        tags: null,
                    },
                },
                rejectedEventCount: {
                    enable: false,
                    influxdb: {
                        measurementName: 'qlik_sense_rejected_events',
                    },
                },
                extraProperty: 'not allowed',
            };

            expect(validate(invalidConfig)).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    keyword: 'additionalProperties',
                })
            );
        });
    });
});
