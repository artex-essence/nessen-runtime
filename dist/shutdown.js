"use strict";
/**
 * shutdown.ts
 * Graceful shutdown: stop accepting new requests, drain active, close server.
 * Signal handling helpers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = gracefulShutdown;
exports.setupSignalHandlers = setupSignalHandlers;
const DRAIN_TIMEOUT_MS = 30000; // 30 seconds max drain time
/**
 * Perform graceful shutdown sequence.
 */
async function gracefulShutdown(server, state, options) {
    const { signal, timeout = DRAIN_TIMEOUT_MS } = options;
    console.log(`[shutdown] Received ${signal}, starting graceful shutdown...`);
    // Transition to DRAINING
    if (!state.transition('DRAINING')) {
        console.log('[shutdown] Already draining or stopped');
        return;
    }
    // Stop accepting new connections
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
    await waitForDrain(timeout, () => {
        const elapsed = Date.now() - drainStart;
        console.log(`[shutdown] Draining... (${elapsed}ms elapsed)`);
    });
    // Transition to STOPPING
    state.transition('STOPPING');
    console.log('[shutdown] Shutdown complete');
    // Exit process
    process.exit(0);
}
/**
 * Wait for active requests to drain or timeout.
 */
async function waitForDrain(timeoutMs, onTick) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // In production, check active request count from telemetry
        // For now, just wait a bit
        await sleep(100);
        onTick();
    }
}
/**
 * Sleep helper.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Setup signal handlers for graceful shutdown.
 */
function setupSignalHandlers(server, state) {
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
        process.on(signal, () => {
            gracefulShutdown(server, state, { signal }).catch(err => {
                console.error('[shutdown] Fatal error during shutdown:', err);
                process.exit(1);
            });
        });
    });
    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
        console.error('[fatal] Uncaught exception:', err);
        gracefulShutdown(server, state, { signal: 'uncaughtException', timeout: 5000 }).catch(() => {
            process.exit(1);
        });
    });
    process.on('unhandledRejection', (reason) => {
        console.error('[fatal] Unhandled rejection:', reason);
        gracefulShutdown(server, state, { signal: 'unhandledRejection', timeout: 5000 }).catch(() => {
            process.exit(1);
        });
    });
}
//# sourceMappingURL=shutdown.js.map