"use strict";
/**
 * health.ts
 * Health and readiness endpoint logic based on runtime state and telemetry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLiveness = handleLiveness;
exports.handleReadiness = handleReadiness;
exports.handleHealthApi = handleHealthApi;
const response_js_1 = require("./response.js");
/**
 * Handle /health (liveness) endpoint.
 * Returns 200 if process is alive, 503 if stopping.
 */
function handleLiveness(state) {
    if (state.isAlive()) {
        return (0, response_js_1.textResponse)('OK', 200);
    }
    return (0, response_js_1.textResponse)('Stopping', 503);
}
/**
 * Handle /ready (readiness) endpoint.
 * Returns 200 only when READY, 503 otherwise.
 */
function handleReadiness(state) {
    if (state.isReady()) {
        return (0, response_js_1.textResponse)('Ready', 200);
    }
    return (0, response_js_1.textResponse)(`Not ready: ${state.current}`, 503);
}
/**
 * Handle /api/health (detailed health check).
 * Returns JSON with state, uptime, memory, CPU, event-loop lag.
 */
function handleHealthApi(state, telemetry) {
    telemetry.refreshSnapshot();
    const snapshot = telemetry.getSnapshot();
    const data = {
        ok: state.canAcceptRequests(),
        state: state.current,
        uptimeMs: state.uptimeMs,
        mem: snapshot.memoryUsageMB,
        cpu: snapshot.cpuUsagePercent,
        eventLoopLagMs: snapshot.eventLoopLagMs,
        requests: {
            total: snapshot.requestsTotal,
            active: snapshot.requestsActive,
            p50Ms: snapshot.requestDurationP50Ms,
            p95Ms: snapshot.requestDurationP95Ms,
            p99Ms: snapshot.requestDurationP99Ms,
            avgResponseBytes: snapshot.responseSizeAvgBytes,
        },
    };
    const statusCode = state.canAcceptRequests() ? 200 : 503;
    return (0, response_js_1.jsonResponse)(data, statusCode);
}
//# sourceMappingURL=health.js.map