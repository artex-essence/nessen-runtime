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
import type { RequestEnvelope, RuntimeResponse } from './envelope.js';
import { StateManager } from './state.js';
import { Telemetry } from './telemetry.js';
import { type MiddlewareHandler } from './middleware.js';
import { type RuntimeConfig } from './config.js';
import type { Logger } from './logger.js';
/**
 * Core runtime engine. Single instance created by server.ts.
 */
export declare class Runtime {
    private readonly state;
    private readonly telemetry;
    private readonly router;
    private readonly pipeline;
    private readonly config;
    private readonly logger;
    constructor(config?: RuntimeConfig, logger?: Logger);
    /**
     * Setup routes during initialization.
     */
    private setupRoutes;
    /**
     * Handle request envelope. Main entry point.
     */
    handle(envelope: RequestEnvelope): Promise<RuntimeResponse>;
    /**
     * Internal request handling (after state gating).
     */
    private handleInternal;
    /**
     * Dispatch to named handler.
     */
    private dispatch;
    /**
     * Get state manager (for server.ts shutdown).
     */
    getState(): StateManager;
    /**
     * Get telemetry (for monitoring).
     */
    getTelemetry(): Telemetry;
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
    use(handler: MiddlewareHandler): this;
    /**
     * @deprecated Use `use()` instead. This method will be removed in v2.0.
     * @param handler - Middleware handler to add to the pipeline
     * @returns - Returns this for chaining
     */
    extendPipeline(handler: MiddlewareHandler): this;
}
export type { RequestContext } from './context.js';
//# sourceMappingURL=runtime.d.ts.map