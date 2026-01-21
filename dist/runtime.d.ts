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
/**
 * Core runtime engine. Single instance created by server.ts.
 */
export declare class Runtime {
    private readonly state;
    private readonly telemetry;
    private readonly router;
    constructor();
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
     * Timeout handler returns 503 after timeout (with cancellation support).
     */
    private timeoutHandler;
    /**
     * Get state manager (for server.ts shutdown).
     */
    getState(): StateManager;
    /**
     * Get telemetry (for monitoring).
     */
    getTelemetry(): Telemetry;
}
export type { RequestContext } from './context.js';
//# sourceMappingURL=runtime.d.ts.map