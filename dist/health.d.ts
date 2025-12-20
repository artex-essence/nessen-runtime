/**
 * health.ts
 * Health and readiness endpoint logic based on runtime state and telemetry.
 */
import type { StateManager } from './state.js';
import type { Telemetry } from './telemetry.js';
import type { RuntimeResponse } from './envelope.js';
/**
 * Handle /health (liveness) endpoint.
 * Returns 200 if process is alive, 503 if stopping.
 */
export declare function handleLiveness(state: StateManager): RuntimeResponse;
/**
 * Handle /ready (readiness) endpoint.
 * Returns 200 only when READY, 503 otherwise.
 */
export declare function handleReadiness(state: StateManager): RuntimeResponse;
/**
 * Handle /api/health (detailed health check).
 * Returns JSON with state, uptime, memory, CPU, event-loop lag.
 */
export declare function handleHealthApi(state: StateManager, telemetry: Telemetry): RuntimeResponse;
//# sourceMappingURL=health.d.ts.map