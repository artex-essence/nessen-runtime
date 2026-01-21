"use strict";
/**
 * runtime.ts
 *
 * Core request handling runtime implementing the state machine, routing, and telemetry.
 * Operates on transport-neutral RequestEnvelope/RuntimeResponse types, enabling use
 * with any HTTP framework or protocol. Enforces request timeouts, state gating, and
 * security validations.
 *
 * @module runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runtime = void 0;
const state_js_1 = require("./state.js");
const telemetry_js_1 = require("./telemetry.js");
const router_js_1 = require("./router.js");
const classify_js_1 = require("./classify.js");
const context_js_1 = require("./context.js");
const handlers_js_1 = require("./handlers.js");
const health_js_1 = require("./health.js");
const response_js_1 = require("./response.js");
const utils_js_1 = require("./utils.js");
const middleware_js_1 = require("./middleware.js");
const logging_js_1 = require("./middleware/logging.js");
const rateLimit_js_1 = require("./middleware/rateLimit.js");
const compression_js_1 = require("./middleware/compression.js");
const config_js_1 = require("./config.js");
/**
 * Core runtime engine. Single instance created by server.ts.
 */
class Runtime {
    state;
    telemetry;
    router;
    pipeline;
    config;
    logger;
    constructor(config = (0, config_js_1.createConfig)(), logger = console) {
        this.state = new state_js_1.StateManager();
        this.telemetry = new telemetry_js_1.Telemetry();
        this.router = new router_js_1.Router();
        this.config = config;
        this.logger = logger;
        this.pipeline = new middleware_js_1.MiddlewarePipeline()
            .use((0, logging_js_1.createLoggingMiddleware)({ logger }))
            .use((0, rateLimit_js_1.createRateLimitMiddleware)({
            maxRequests: this.config.rateLimitMaxRequests,
            windowMs: this.config.rateLimitWindowMs,
            maxKeys: this.config.rateLimitMaxKeys,
            cleanupIntervalMs: this.config.rateLimitCleanupMs,
            keyGenerator: this.config.rateLimitKeyExtractor,
        }))
            .use((0, compression_js_1.createCompressionMiddleware)());
        // Register routes
        this.setupRoutes();
        // Transition to READY immediately (initialization is synchronous)
        if (this.state.transition('READY')) {
            this.logger.info('[runtime] State: READY');
        }
    }
    /**
     * Setup routes during initialization.
     */
    setupRoutes() {
        this.router.register('GET', '/', 'home');
        this.router.register('GET', '/health', 'liveness');
        this.router.register('GET', '/ready', 'readiness');
        this.router.register('GET', '/api/health', 'healthApi');
        this.router.register('GET', '/badge/:label/:value.svg', 'badge');
    }
    /**
     * Handle request envelope. Main entry point.
     */
    async handle(envelope) {
        // State gating: reject if draining or stopping
        if (!this.state.canAcceptRequests()) {
            return (0, response_js_1.serviceUnavailableResponse)(`Runtime state: ${this.state.current}`, envelope.id);
        }
        // Record request start
        this.telemetry.requestStart();
        // Create AbortController for request cancellation
        const abortController = new AbortController();
        let timeoutHandle;
        let responseSize = 0;
        try {
            const timeout = new Promise((resolve) => {
                timeoutHandle = setTimeout(() => {
                    abortController.abort('Request timeout');
                    resolve((0, response_js_1.errorResponse)('Request timeout', 504, false, undefined, envelope.id));
                }, this.config.requestTimeoutMs);
                timeoutHandle.unref?.();
            });
            const response = await Promise.race([
                this.handleInternal(envelope, abortController.signal),
                timeout,
            ]);
            // Calculate response size for telemetry
            responseSize = Buffer.isBuffer(response.body)
                ? response.body.length
                : Buffer.byteLength(response.body, 'utf8');
            // Enforce response size limits
            if (responseSize > this.config.maxResponseSize) {
                return (0, response_js_1.errorResponse)('Response too large', 413, false, undefined, envelope.id);
            }
            return response;
        }
        catch (error) {
            this.logger.error(`[runtime] [${envelope.id}] Error handling request:`, { error });
            const err = error instanceof Error ? error : new Error(String(error));
            const errorResp = (0, response_js_1.errorResponse)('Internal server error', 500, false, err, envelope.id);
            responseSize = Buffer.byteLength(errorResp.body.toString(), 'utf8');
            return errorResp;
        }
        finally {
            // Clear timeout timer
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            // Record request end with response size
            this.telemetry.requestEnd(envelope.startTime, responseSize);
        }
    }
    /**
     * Internal request handling (after state gating).
     */
    async handleInternal(envelope, abortSignal) {
        // Classify request
        const classification = (0, classify_js_1.classifyRequest)(envelope);
        // Security: validate path
        if (!(0, utils_js_1.isPathSafe)(classification.pathInfo)) {
            return (0, response_js_1.errorResponse)('Invalid path', 400, classification.expects === 'json', undefined, envelope.id);
        }
        // Route matching
        const match = this.router.match(envelope.method, classification.pathInfo);
        if (!match) {
            return (0, response_js_1.notFoundResponse)(classification.pathInfo, classification.expects === 'json', envelope.id);
        }
        // Build context with abort signal
        const ctx = (0, context_js_1.createContext)(envelope, classification, match.params, abortSignal);
        // Dispatch through middleware pipeline and handler
        const finalHandler = (context) => this.dispatch(match.handler, context);
        return this.pipeline.handle(ctx, finalHandler);
    }
    /**
     * Dispatch to named handler.
     */
    dispatch(handler, ctx) {
        switch (handler) {
            case 'home':
                return (0, handlers_js_1.handleHome)(ctx, this.state.current);
            case 'liveness':
                return (0, health_js_1.handleLiveness)(this.state);
            case 'readiness':
                // Note: handleReadiness returns Promise<RuntimeResponse>
                return (0, health_js_1.handleReadiness)(this.state);
            case 'healthApi':
                return (0, health_js_1.handleHealthApi)(this.state, this.telemetry);
            case 'badge':
                return (0, handlers_js_1.handleBadge)(ctx);
            default:
                return (0, response_js_1.notFoundResponse)(ctx.pathInfo, ctx.expects === 'json', ctx.id);
        }
    }
    /**
     * Get state manager (for server.ts shutdown).
     */
    getState() {
        return this.state;
    }
    /**
     * Get telemetry (for monitoring).
     */
    getTelemetry() {
        return this.telemetry;
    }
    /**
     * Allow callers to extend the middleware pipeline with custom middleware.
     */
    /**
     * Add middleware to the processing pipeline.
     * Middleware is executed in registration order for all requests.
     *
     * @param handler - Middleware handler to add to the pipeline
     * @returns - Returns this for chaining
     * @example
     * ```typescript
     * runtime.use(loggingMiddleware);
     * runtime.use(authMiddleware);
     * ```
     */
    use(handler) {
        this.pipeline.use(handler);
        return this;
    }
    /**
     * @deprecated Use `use()` instead. This method will be removed in v2.0.
     * @param handler - Middleware handler to add to the pipeline
     * @returns - Returns this for chaining
     */
    extendPipeline(handler) {
        return this.use(handler);
    }
}
exports.Runtime = Runtime;
//# sourceMappingURL=runtime.js.map