/**
 * health.ts
 *
 * Health check endpoint handlers for orchestration and monitoring.
 * Implements Kubernetes-style liveness and readiness probes, plus detailed health API.
 *
 * Endpoints:
 * - GET /health: Liveness check (is process alive?)
 * - GET /ready: Readiness check (is ready for traffic?)
 * - GET /api/health: Detailed metrics (JSON)
 *
 * @module health
 */
import type { StateManager } from './state.js';
import type { Telemetry } from './telemetry.js';
import type { RuntimeResponse } from './envelope.js';
/**
 * Handles GET /health (liveness probe).
 *
 * Returns 200 OK if the process is alive and running.
 * Used by orchestration platforms (Kubernetes) to determine if the container
 * should be restarted. Should fail only if the process is truly dead/stopping.
 *
 * @param state - Runtime state manager
 * @returns 200 if alive, 503 if stopping
 */
export declare function handleLiveness(state: StateManager): RuntimeResponse;
/**
 * Handles GET /ready (readiness probe).
 *
 * Returns 200 OK if the runtime is fully ready to accept traffic.
 * Used by orchestration platforms to determine if the instance should
 * receive traffic. Returns 503 if draining, degraded, or not yet started.
 *
 * @param state - Runtime state manager
 * @returns 200 if ready, 503 if not ready (includes reason)
 */
export declare function handleReadiness(state: StateManager): RuntimeResponse;
/**
 * Handles GET /api/health (detailed health check).
 *
 * Returns comprehensive JSON health information useful for:
 * - Monitoring dashboards
 * - Performance debugging
 * - Capacity planning
 * - Identifying problems
 *
 * Refreshes telemetry snapshot on each call (relatively expensive).
 * In production, consider caching this endpoint or reducing call frequency.
 *
 * @param state - Runtime state manager
 * @param telemetry - Telemetry collector
 * @returns JSON response with detailed health metrics
 */
export declare function handleHealthApi(state: StateManager, telemetry: Telemetry): RuntimeResponse;
//# sourceMappingURL=health.d.ts.map