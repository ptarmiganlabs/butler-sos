import Fastify from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyCors from '@fastify/cors';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import globals from '../globals.js';
import { downloadScreenshot } from './audit-screenshots.js';

/**
 * @typedef {object} AuditEventEnvelope
 * @property {number} schemaVersion - Schema version of the envelope.
 * @property {string} eventId - Unique ID for this event.
 * @property {string} [correlationId] - Optional correlation ID linking related events.
 * @property {string} timestamp - ISO-8601 timestamp.
 * @property {string} type - Message type identifier.
 * @property {Record<string, unknown>} [source] - Optional source metadata.
 * @property {Record<string, unknown>} payload - Event-type-specific payload.
 */

/**
 * @typedef {object} AuditRequestContext
 * @property {string} ip - Client IP address.
 */

/**
 * Returns the Fastify route schema for the audit events endpoint.
 *
 * The schema validates the incoming audit event envelope (versioned message)
 * and defines the success response payload.
 *
 * The envelope is intentionally forward-compatible:
 * - `additionalProperties: true` allows adding fields without breaking older servers.
 * - `payload` is open-ended to allow future message type expansions.
 *
 * @returns {import('fastify').RouteShorthandOptions['schema']} Fastify schema for request/response.
 */
function getAuditEventSchema() {
    return {
        body: {
            type: 'object',
            properties: {
                schemaVersion: { type: 'integer', minimum: 1 },
                eventId: { type: 'string', minLength: 1 },
                correlationId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                type: { type: 'string', minLength: 1 },
                source: {
                    type: 'object',
                    additionalProperties: true,
                },
                payload: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['schemaVersion', 'eventId', 'timestamp', 'type', 'payload'],
            additionalProperties: true,
        },
        response: {
            202: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    receivedAt: { type: 'string', format: 'date-time' },
                },
                required: ['status', 'receivedAt'],
            },
        },
    };
}

/**
 * Builds CORS configuration for the audit events API.
 *
 * Since the audit extension calls the API from a browser, CORS must be configured.
 * Best-practice default is to disable CORS unless explicitly allow-listed.
 *
 * Supported behavior:
 * - Empty list => CORS disabled (`origin: false`).
 * - Includes `*` => allow any origin (not recommended except for controlled testing).
 * - Otherwise => only allow listed origins.
 *
 * @param {unknown} corsOriginList - Value from config (`Butler-SOS.auditEvents.cors.allowedOrigins`).
 *
 * @returns {import('@fastify/cors').FastifyCorsOptions} CORS options for `@fastify/cors`.
 */
function buildCorsOptions(corsOriginList) {
    const origins = Array.isArray(corsOriginList) ? corsOriginList : [];

    // Best-practice default: no CORS unless explicitly configured.
    if (origins.length === 0) {
        return { origin: false };
    }

    // If wildcard is present, reflect origin (still requires token auth).
    if (origins.includes('*')) {
        return {
            origin: true,
            credentials: false,
            allowedHeaders: ['Content-Type', 'Authorization'],
            methods: ['POST', 'OPTIONS'],
        };
    }

    return {
        origin: origins,
        credentials: false,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['POST', 'OPTIONS'],
    };
}

/**
 * Extracts the bearer token from an HTTP Authorization header.
 *
 * @param {unknown} authorizationHeader - Value of the `Authorization` header.
 *
 * @returns {string|null} The extracted token, or null if not present/invalid.
 */
function getBearerToken(authorizationHeader) {
    if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
    const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}

/**
 * Creates per-message-type handlers for audit event envelopes.
 *
 * The API is designed to be extensible: add more keys to the returned object
 * to support new `envelope.type` values.
 *
 * @param {object} logger - Logger instance to use.
 *
 * @returns {Record<string, (envelope: unknown, requestContext: AuditRequestContext) => Promise<void>>}
 *   Map from `envelope.type` to async handler.
 */
function createTypeHandlers(logger) {
    /**
     * Handles a screenshot URL notification sent by the audit extension.
     *
     * @param {unknown} envelope - The received audit event envelope.
     * @param {AuditRequestContext} requestContext - Minimal request context.
     *
     * @returns {Promise<void>} Resolves when logging is complete.
     */
    async function handleScreenshotUrlReceived(envelope, requestContext) {
        // Envelope shape is validated at the route level. Payload remains intentionally open-ended.
        const screenshotUrl = envelope?.payload?.event?.screenshotUrl;
        const objectId = envelope?.payload?.event?.objectId;
        logger.info(
            `AUDIT API: screenshot.url.received eventId=${envelope.eventId} objectId=${objectId} url=${screenshotUrl} ip=${requestContext.ip}`
        );

        const screenshotsEnabled =
            globals.config.has('Butler-SOS.auditEvents.screenshots.enable') &&
            globals.config.get('Butler-SOS.auditEvents.screenshots.enable') === true;

        if (!screenshotsEnabled) return;
        if (typeof screenshotUrl !== 'string' || screenshotUrl.length === 0) {
            logger.warn(
                `AUDIT API: Screenshot download enabled, but screenshotUrl is missing eventId=${envelope.eventId}`
            );
            return;
        }

        const screenshotDownloadConfig = {
            enable: true,
            downloadTimeoutMs: globals.config.get(
                'Butler-SOS.auditEvents.screenshots.downloadTimeoutMs'
            ),
            auth: globals.config.has('Butler-SOS.auditEvents.screenshots.auth')
                ? globals.config.get('Butler-SOS.auditEvents.screenshots.auth')
                : undefined,
            storageTargets: globals.config.get('Butler-SOS.auditEvents.screenshots.storageTargets'),
        };

        await downloadScreenshot(screenshotUrl, envelope, screenshotDownloadConfig, logger);
    }

    return {
        'screenshot.url.received': handleScreenshotUrlReceived,
    };
}

/**
 * Creates AJV validators for audit-event payloads, keyed by `envelope.type`.
 *
 * If a type is missing from the returned map, no payload validation is performed.
 *
 * @returns {{ validatePayloadByType: Record<string, import('ajv').ValidateFunction> }} Validators keyed by message type.
 */
function createPayloadValidators() {
    const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
    addFormats(ajv);

    /**
     * Payload schema for screenshot.url.received.
     *
     * Expected shape: { event: { screenshotUrl: string, objectId?: string } }
     */
    const screenshotUrlReceivedPayloadSchema = {
        type: 'object',
        properties: {
            event: {
                type: 'object',
                properties: {
                    screenshotUrl: { type: 'string', minLength: 1, format: 'uri' },
                    objectId: { type: ['string', 'null'] },
                },
                required: ['screenshotUrl'],
                additionalProperties: true,
            },
        },
        required: ['event'],
        additionalProperties: true,
    };

    return {
        validatePayloadByType: {
            'screenshot.url.received': ajv.compile(screenshotUrlReceivedPayloadSchema),
        },
    };
}

/**
 * Registers audit event routes and supporting middleware on a Fastify instance.
 *
 * Adds:
 * - `@fastify/cors` for browser-origin calls
 * - `@fastify/rate-limit` to reduce abuse
 * - A simple bearer token check (if `apiToken` is configured)
 * - `POST /api/v1/audit-event` route that validates/logs and dispatches by `type`
 *
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance to register routes on.
 * @param {object} [options] - Registration options.
 * @param {string} [options.apiToken] - Bearer token expected in `Authorization` header.
 * @param {string[]} [options.corsOrigins] - Allowed CORS origins.
 *
 * @returns {Promise<void>} Resolves when registration is complete.
 */
async function registerAuditEventRoutes(fastify, { apiToken, corsOrigins } = {}) {
    // CORS (browser calls)
    await fastify.register(FastifyCors, buildCorsOptions(corsOrigins));

    // Rate limit (simple abuse protection)
    await fastify.register(FastifyRateLimit, {
        max: 300,
        timeWindow: '1 minute',
    });

    /**
     * Fastify `preHandler` hook that enforces simple bearer-token authentication.
     *
     * If no `apiToken` is configured, authentication is skipped.
     *
     * @param {import('fastify').FastifyRequest} request - Fastify request.
     * @param {import('fastify').FastifyReply} reply - Fastify reply.
     *
     * @returns {Promise<void>} Resolves when the request is allowed to proceed.
     */
    async function auditEventAuthPreHandler(request, reply) {
        if (!apiToken) return;

        const token = getBearerToken(request.headers.authorization);
        if (!token || token !== apiToken) {
            globals.logger.warn(
                `AUDIT API: Unauthorized request ip=${request.ip} method=${request.method} url=${request.url}`
            );
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    }

    // Auth hook (simple token + CORS)
    fastify.addHook('preHandler', auditEventAuthPreHandler);

    const handlers = createTypeHandlers(globals.logger);
    const { validatePayloadByType } = createPayloadValidators();

    /**
     * Validates `envelope.payload` using a per-type AJV schema.
     *
     * If a schema is not registered for the given type, validation is skipped.
     *
     * @param {AuditEventEnvelope} envelope - The received audit event envelope
     * @returns {boolean} True if payload is valid (or validation skipped), false otherwise
     */
    function validatePayload(envelope) {
        const validator = validatePayloadByType[envelope?.type];
        if (!validator) return true;

        const ok = validator(envelope?.payload);
        if (!ok) {
            globals.logger.warn(
                `AUDIT API: Payload validation failed type=${envelope?.type} eventId=${envelope?.eventId} errors=${JSON.stringify(
                    validator.errors
                )}`
            );
        }
        return ok;
    }

    /**
     * Processes an audit event envelope by dispatching to a type-specific handler.
     *
     * @param {AuditEventEnvelope} envelope - The received audit event envelope
     * @param {AuditRequestContext} requestContext - Minimal request context safe to use asynchronously
     * @returns {Promise<void>}
     */
    async function processAuditEventEnvelope(envelope, requestContext) {
        const handler = handlers[envelope.type];
        if (handler) {
            await handler(envelope, requestContext);
            return;
        }

        globals.logger.info(
            `AUDIT API: Received audit event type=${envelope.type} eventId=${envelope.eventId} ip=${requestContext.ip}`
        );
        globals.logger.info(`AUDIT API: Full envelope: ${JSON.stringify(envelope)}`);
    }

    /**
     * Fastify route handler for receiving audit events.
     *
     * Validates the envelope (via JSON schema), then dispatches by `envelope.type`.
     * Unknown types are accepted and logged for future implementation.
     *
     * @param {import('fastify').FastifyRequest} request - Fastify request.
     * @param {import('fastify').FastifyReply} reply - Fastify reply.
     *
     * @returns {Promise<void>} Resolves when the response is sent.
     */
    async function handleAuditEventPost(request, reply) {
        /** @type {AuditEventEnvelope} */
        const envelope = request.body;

        const requestContext = {
            ip: request.ip,
        };

        // Validate payload structure using per-type AJV schema (envelope is validated by Fastify schema).
        // If payload validation fails, accept-and-drop.
        if (!validatePayload(envelope)) {
            return reply
                .code(202)
                .send({ status: 'accepted', receivedAt: new Date().toISOString() });
        }

        // If queue manager is available, enqueue processing and return quickly.
        const queueManager = globals.auditEventsQueueManager;
        if (queueManager) {
            try {
                // Drop on rate limit
                if (!queueManager.checkRateLimit()) {
                    await queueManager.handleRateLimitDrop();
                    globals.logger.warn(
                        `AUDIT API: Dropped audit event due to queue rate limit type=${envelope.type} eventId=${envelope.eventId} ip=${request.ip}`
                    );
                    return reply
                        .code(202)
                        .send({ status: 'accepted', receivedAt: new Date().toISOString() });
                }

                const queued = await queueManager.addToQueue(async () => {
                    await processAuditEventEnvelope(envelope, requestContext);
                });

                if (!queued) {
                    globals.logger.warn(
                        `AUDIT API: Dropped audit event due to full queue type=${envelope.type} eventId=${envelope.eventId} ip=${request.ip}`
                    );
                }
            } catch (err) {
                globals.logger.error(
                    `AUDIT API: Error while enqueueing audit event: ${globals.getErrorMessage(err)}`
                );
            }

            return reply
                .code(202)
                .send({ status: 'accepted', receivedAt: new Date().toISOString() });
        }

        try {
            await processAuditEventEnvelope(envelope, requestContext);
        } catch (err) {
            globals.logger.error(
                `AUDIT API: Error while handling audit event: ${globals.getErrorMessage(err)}`
            );
        }

        reply.code(202).send({ status: 'accepted', receivedAt: new Date().toISOString() });
    }

    fastify.post('/api/v1/audit-event', { schema: getAuditEventSchema() }, handleAuditEventPost);
}

/**
 * Starts a dedicated Fastify server for receiving audit events from the browser extension.
 *
 * The server reads config from:
 * - `Butler-SOS.auditEvents.enable`
 * - `Butler-SOS.auditEvents.host`
 * - `Butler-SOS.auditEvents.port`
 * - `Butler-SOS.auditEvents.apiToken`
 * - `Butler-SOS.auditEvents.cors.allowedOrigins`
 *
 * If disabled, this function logs and returns without starting a server.
 *
 * @returns {Promise<void>} Resolves when the server is started (or skipped if disabled).
 *
 * @throws {Error} Re-throws startup errors after logging.
 */
export async function setupAuditEventsApiServer() {
    try {
        const enabled =
            globals.config.has('Butler-SOS.auditEvents.enable') &&
            globals.config.get('Butler-SOS.auditEvents.enable') === true;

        if (!enabled) {
            globals.logger.info('AUDIT API: Audit events API is disabled.');
            return;
        }

        const auditServer = Fastify({ logger: true });

        // Keep Fastify logs quiet; use Butler SOS logger instead.
        const currLogLevel = globals.getLoggingLevel();
        if (currLogLevel === 'debug' || currLogLevel === 'silly') {
            auditServer.log.level = 'info';
        } else {
            auditServer.log.level = 'silent';
        }

        const apiToken = globals.config.get('Butler-SOS.auditEvents.apiToken');
        const corsOrigins = globals.config.get('Butler-SOS.auditEvents.cors.allowedOrigins');

        await registerAuditEventRoutes(auditServer, { apiToken, corsOrigins });

        const host = globals.config.get('Butler-SOS.auditEvents.host');
        const port = globals.config.get('Butler-SOS.auditEvents.port');

        await auditServer.listen({ host, port });

        globals.logger.info(`AUDIT API: Listening on http://${host}:${port}/api/v1/audit-event`);
        if (!apiToken) {
            globals.logger.warn(
                'AUDIT API: No apiToken configured. This is not recommended; set Butler-SOS.auditEvents.apiToken.'
            );
        }
    } catch (err) {
        globals.logger.error(
            `AUDIT API: Error setting up audit events API: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

export { registerAuditEventRoutes };
