/**
 * health.ts
 * Health and readiness endpoint logic based on runtime state and telemetry.
 */

import type { StateManager } from './state.js';
import type { Telemetry } from './telemetry.js';
import { jsonResponse, textResponse } from './response.js';
import type { RuntimeResponse } from './envelope.js';

/**
 * Handle /health (liveness) endpoint.
 * Returns 200 if process is alive, 503 if stopping.
 */
export function handleLiveness(state: StateManager): RuntimeResponse {
  if (state.isAlive()) {
    return textResponse('OK', 200);
  }
  return textResponse('Stopping', 503);
}

/**
 * Handle /ready (readiness) endpoint.
 * Returns 200 only when READY, 503 otherwise.
 */
export function handleReadiness(state: StateManager): RuntimeResponse {
  if (state.isReady()) {
    return textResponse('Ready', 200);
  }
  return textResponse(`Not ready: ${state.current}`, 503);
}

/**
 * Handle /api/health (detailed health check).
 * Returns JSON with state, uptime, memory, CPU, event-loop lag.
 */
export function handleHealthApi(state: StateManager, telemetry: Telemetry): RuntimeResponse {
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
  return jsonResponse(data, statusCode);
}
