"use strict";
/**
 * shutdown.ts
 *
 * Graceful shutdown system implementing proper signal handling and request draining.
 * Transitions runtime through DRAINING and STOPPING states, waits for active requests
 * to complete, and ensures clean process exit. Prevents orphaned timers.
 *
 * @module shutdown
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = gracefulShutdown;
exports.setupSignalHandlers = setupSignalHandlers;
const DRAIN_TIMEOUT_MS = 30000; // 30 seconds max drain time
const DRAIN_CHECK_INTERVAL_MS = 100; // Check every 100ms
/**
 * Performs graceful shutdown sequence with proper cleanup.
 *
 * Implements a multi-phase shutdown:
 * 1. Transition to DRAINING state (stop accepting new requests)
 * 2. Close HTTP server to reject new connections
 * 3. Wait for active requests to complete (with timeout)
 * 4. Transition to STOPPING state
 * 5. Exit process
 *
 * @param server - HTTP server to close
 * @param state - Runtime state manager
 * @param telemetry - Telemetry system to shutdown
 * @param options - Shutdown options (signal name, timeout)
 */
async function gracefulShutdown(server, state, telemetry, options) {
    const { signal, timeout = DRAIN_TIMEOUT_MS } = options;
    console.log(`[shutdown] Received ${signal}, starting graceful shutdown...`);
    // Transition to DRAINING state (stops accepting new requests)
    if (!state.transition('DRAINING')) {
        console.log('[shutdown] Already draining or stopped');
        const snapshot = telemetry.getSnapshot();
        return { drained: snapshot.requestsActive === 0, activeRequests: snapshot.requestsActive };
    }
    // Stop accepting new connections from clients
    server.close((err) => {
        if (err) {
            console.error('[shutdown] Error closing server:', err);
        }
        else {
            console.log('[shutdown] Server closed');
        }
    });
    // Wait for active requests to complete or timeout
    const drainStart = Date.now();
    const drainResult = await waitForDrain(telemetry, timeout, () => {
        const elapsed = Date.now() - drainStart;
        const snapshot = telemetry.getSnapshot();
        console.log(`[shutdown] Draining... (${elapsed}ms, ${snapshot.requestsActive} active requests)`);
    });
    // Clean up telemetry (clears monitoring intervals)
    telemetry.shutdown();
    // Transition to STOPPING state
    state.transition('STOPPING');
    console.log('[shutdown] Graceful shutdown complete');
    return drainResult;
}
/**
 * Waits for active requests to complete or timeout.
 *
 * Polls the telemetry system to check if all requests have completed.
 * Exits early if no requests are active. Logs progress periodically.
 *
 * @param telemetry - Telemetry system to check request count
 * @param timeoutMs - Maximum time to wait before forcing shutdown
 * @param onTick - Callback to log progress
 */
async function waitForDrain(telemetry, timeoutMs, onTick) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // Check active request count from telemetry
        const snapshot = telemetry.getSnapshot();
        if (snapshot.requestsActive === 0) {
            console.log('[shutdown] All active requests completed');
            return { drained: true, activeRequests: 0 };
        }
        // Wait a bit before checking again
        await sleep(DRAIN_CHECK_INTERVAL_MS);
        onTick();
    }
    const remaining = telemetry.getSnapshot().requestsActive;
    console.warn(`[shutdown] Drain timeout exceeded, forcing shutdown with ${remaining} active requests`);
    return { drained: false, activeRequests: remaining };
}
/**
 * Sleeps for the specified duration.
 *
 * Simple Promise-based sleep utility for use with async/await.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Sets up signal handlers for graceful shutdown.
 *
 * Registers handlers for:
 * - SIGTERM / SIGINT: Normal shutdown signals
 * - uncaughtException: Runtime errors not caught elsewhere
 * - unhandledRejection: Promise rejections not caught
 *
 * All handlers trigger graceful shutdown sequences with appropriate timeouts.
 * unhandledRejection and uncaughtException use shortened timeouts to prevent
 * hanging on error conditions.
 *
 * @param server - HTTP server to shutdown
 * @param state - Runtime state manager
 * @param telemetry - Telemetry system to shutdown
 */
function setupSignalHandlers(server, state, telemetry, onComplete) {
    const signals = ['SIGTERM', 'SIGINT'];
    const handle = async (signal, timeout) => {
        try {
            const result = await gracefulShutdown(server, state, telemetry, { signal, timeout });
            const exitCode = result.drained ? 0 : 1;
            onComplete?.(result, exitCode);
        }
        catch (err) {
            console.error('[shutdown] Fatal error during shutdown:', err);
            onComplete?.({ drained: false, activeRequests: -1 }, 1);
        }
    };
    // Normal shutdown signals
    signals.forEach(signal => {
        process.on(signal, () => {
            void handle(signal);
        });
    });
    // Uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('[fatal] Uncaught exception:', err);
        void handle('uncaughtException', 5000);
    });
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        console.error('[fatal] Unhandled rejection:', reason);
        void handle('unhandledRejection', 5000);
    });
}
//# sourceMappingURL=shutdown.js.map