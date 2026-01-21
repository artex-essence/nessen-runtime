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
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds per-request timeout
/**
 * Core runtime engine. Single instance created by server.ts.
 */
class Runtime {
    state;
    telemetry;
    router;
    constructor() {
        this.state = new state_js_1.StateManager();
        this.telemetry = new telemetry_js_1.Telemetry();
        this.router = new router_js_1.Router();
        // Register routes
        this.setupRoutes();
        // Transition to READY after initialization
        setTimeout(() => {
            if (this.state.transition('READY')) {
                console.log('[runtime] State: READY');
            }
        }, 100);
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
        let responseSize = 0;
        try {
            // Enforce timeout with cancellable timer
            const timeoutController = { cancelled: false };
            const response = await Promise.race([
                this.handleInternal(envelope),
                this.timeoutHandler(REQUEST_TIMEOUT_MS, timeoutController, envelope.id),
            ]);
            // Cancel timeout to prevent memory leak
            timeoutController.cancelled = true;
            // Calculate response size for telemetry
            responseSize = Buffer.isBuffer(response.body)
                ? response.body.length
                : Buffer.byteLength(response.body, 'utf8');
            return response;
        }
        catch (error) {
            console.error(`[runtime] [${envelope.id}] Error handling request:`, error);
            const err = error instanceof Error ? error : new Error(String(error));
            const errorResp = (0, response_js_1.errorResponse)('Internal server error', 500, false, err, envelope.id);
            responseSize = Buffer.byteLength(errorResp.body.toString(), 'utf8');
            return errorResp;
        }
        finally {
            // Record request end with response size
            this.telemetry.requestEnd(envelope.startTime, responseSize);
        }
    }
    /**
     * Internal request handling (after state gating).
     */
    async handleInternal(envelope) {
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
        // Build context
        const ctx = (0, context_js_1.createContext)(envelope, classification, match.params);
        // Dispatch to handler
        return this.dispatch(match.handler, ctx);
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
     * Timeout handler returns 503 after timeout (with cancellation support).
     */
    async timeoutHandler(ms, controller, requestId) {
        await new Promise(resolve => {
            const timer = setTimeout(() => {
                if (!controller.cancelled) {
                    resolve();
                }
            }, ms);
            // Check periodically for cancellation to clean up early
            const checkInterval = setInterval(() => {
                if (controller.cancelled) {
                    clearTimeout(timer);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
        return controller.cancelled
            ? (0, response_js_1.errorResponse)('Request completed', 200, false, undefined, requestId) // Never returned
            : (0, response_js_1.errorResponse)('Request timeout', 503, false, undefined, requestId);
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
}
exports.Runtime = Runtime;
//# sourceMappingURL=runtime.js.map