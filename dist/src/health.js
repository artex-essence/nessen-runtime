"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLiveness = handleLiveness;
exports.handleReadiness = handleReadiness;
exports.handleHealthApi = handleHealthApi;
const response_js_1 = require("./response.js");
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
function handleLiveness(state) {
    if (state.isAlive()) {
        return (0, response_js_1.textResponse)('OK', 200);
    }
    return (0, response_js_1.textResponse)('Stopping', 503);
}
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
function handleReadiness(state) {
    if (state.isReady()) {
        return (0, response_js_1.textResponse)('Ready', 200);
    }
    return (0, response_js_1.textResponse)(`Not ready: ${state.current}`, 503);
}
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
function handleHealthApi(state, telemetry) {
    // Refresh snapshot to get fresh metrics
    telemetry.refreshSnapshot();
    const snapshot = telemetry.getSnapshot();
    const data = {
        ok: state.canAcceptRequests(), // Overall health (ready to handle requests)
        state: state.current, // Current runtime state
        uptimeMs: state.uptimeMs, // How long process has been running
        mem: snapshot.memoryUsageMB, // Memory usage (MB)
        cpu: snapshot.cpuUsagePercent, // CPU usage (%)
        eventLoopLagMs: snapshot.eventLoopLagMs, // Event loop lag (ms, 0 = no lag)
        requests: {
            total: snapshot.requestsTotal, // Total requests since startup
            active: snapshot.requestsActive, // Currently in-flight requests
            p50Ms: snapshot.requestDurationP50Ms, // Median request duration
            p95Ms: snapshot.requestDurationP95Ms, // 95th percentile (slow requests)
            p99Ms: snapshot.requestDurationP99Ms, // 99th percentile (very slow requests)
            avgResponseBytes: snapshot.responseSizeAvgBytes, // Average response size
        },
    };
    // HTTP status: 200 if ready, 503 if degraded/draining
    const statusCode = state.canAcceptRequests() ? 200 : 503;
    return (0, response_js_1.jsonResponse)(data, statusCode);
}
//# sourceMappingURL=health.js.map