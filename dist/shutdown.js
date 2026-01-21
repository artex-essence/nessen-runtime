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
// Track ongoing shutdown to ensure idempotency
let shutdownInProgress = null;
let shutdownComplete = null;
/**
 * Performs graceful shutdown sequence with proper cleanup.
 *
 * Implements a multi-phase shutdown:
 * 1. Transition to DRAINING state (stop accepting new requests)
 * 2. Close HTTP server to reject new connections
 * 3. Wait for active requests to complete (with timeout)
 * 4. Transition to STOPPING state
 * 5. Return result (caller decides whether to exit)
 *
 * IDEMPOTENCY: Safe to call multiple times. If shutdown is already in progress,
 * returns the same promise. If already complete, returns the cached result.
 *
 * @param server - HTTP server to close
 * @param state - Runtime state manager
 * @param telemetry - Telemetry system to shutdown
 * @param options - Shutdown options (signal name, timeout)
 */
async function gracefulShutdown(server, state, telemetry, logger, options) {
    // If shutdown already completed, return cached result
    if (shutdownComplete) {
        logger.info('Already completed, returning cached result');
        return shutdownComplete;
    }
    // If shutdown in progress, return existing promise
    if (shutdownInProgress) {
        logger.info('Already in progress, waiting for completion');
        return shutdownInProgress;
    }
    // Start new shutdown sequence
    shutdownInProgress = performShutdown(server, state, telemetry, logger, options);
    try {
        const result = await shutdownInProgress;
        shutdownComplete = result;
        return result;
    }
    finally {
        shutdownInProgress = null;
    }
}
/**
 * Internal shutdown implementation (called once per shutdown).
 */
async function performShutdown(server, state, telemetry, logger, options) {
    const { signal, timeout = DRAIN_TIMEOUT_MS } = options;
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    // Transition to DRAINING state (stops accepting new requests)
    if (!state.transition('DRAINING')) {
        logger.info('Already draining or stopped');
        const snapshot = telemetry.getSnapshot();
        return { drained: snapshot.requestsActive === 0, activeRequests: snapshot.requestsActive };
    }
    // Stop accepting new connections from clients
    server.close((err) => {
        if (err) {
            logger.error('Error closing server:', { error: err });
        }
        else {
            logger.info('Server closed');
        }
    });
    // Wait for active requests to complete or timeout
    const drainStart = Date.now();
    const drainResult = await waitForDrain(telemetry, logger, timeout, () => {
        const elapsed = Date.now() - drainStart;
        const snapshot = telemetry.getSnapshot();
        logger.debug(`Draining... (${elapsed}ms, ${snapshot.requestsActive} active requests)`);
    });
    // Clean up telemetry (clears monitoring intervals)
    telemetry.shutdown();
    // Transition to STOPPING state
    state.transition('STOPPING');
    logger.info('Graceful shutdown complete');
    return drainResult;
}
/**
 * Waits for active requests to complete or timeout.
 *
 * Polls the telemetry system to check if all requests have completed.
 * Exits early if no requests are active. Logs progress periodically.
 *
 * @param telemetry - Telemetry system to check request count
 * @param logger - Logger for progress messages
 * @param timeoutMs - Maximum time to wait before forcing shutdown
 * @param onTick - Callback to log progress
 */
async function waitForDrain(telemetry, logger, timeoutMs, onTick) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // Check active request count from telemetry
        const snapshot = telemetry.getSnapshot();
        if (snapshot.requestsActive === 0) {
            logger.info('All active requests completed');
            return { drained: true, activeRequests: 0 };
        }
        // Wait a bit before checking again
        await sleep(DRAIN_CHECK_INTERVAL_MS);
        onTick();
    }
    const remaining = telemetry.getSnapshot().requestsActive;
    logger.warn(`Drain timeout exceeded, forcing shutdown with ${remaining} active requests`);
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
function setupSignalHandlers(server, state, telemetry, logger, onComplete, options) {
    const signals = ['SIGTERM', 'SIGINT'];
    const handle = async (signal, timeout) => {
        try {
            const result = await gracefulShutdown(server, state, telemetry, logger, {
                signal,
                timeout: timeout ?? options?.shutdownTimeoutMs,
            });
            const exitCode = result.drained ? 0 : 1;
            onComplete?.(result, exitCode);
        }
        catch (err) {
            logger.error('Fatal error during shutdown:', { error: err });
            onComplete?.({ drained: false, activeRequests: -1 }, 1);
        }
    };
    // Normal shutdown signals
    signals.forEach(signal => {
        process.on(signal, () => {
            void handle(signal, options?.shutdownTimeoutMs);
        });
    });
    // Uncaught exceptions
    process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception:', { error: err });
        void handle('uncaughtException', options?.shutdownTimeoutMs ?? 5000);
    });
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection:', { reason });
        void handle('unhandledRejection', options?.shutdownTimeoutMs ?? 5000);
    });
}
//# sourceMappingURL=shutdown.js.map