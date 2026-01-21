/**
 * shutdown.ts
 *
 * Graceful shutdown system implementing proper signal handling and request draining.
 * Transitions runtime through DRAINING and STOPPING states, waits for active requests
 * to complete, and ensures clean process exit. Prevents orphaned timers.
 *
 * @module shutdown
 */

import type { Server } from 'http';
import type { StateManager } from './state.js';
import type { Telemetry } from './telemetry.js';

const DRAIN_TIMEOUT_MS = 30000; // 30 seconds max drain time
const DRAIN_CHECK_INTERVAL_MS = 100; // Check every 100ms

export interface ShutdownOptions {
  readonly signal: string;
  readonly timeout?: number;
}

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
export async function gracefulShutdown(
  server: Server,
  state: StateManager,
  telemetry: Telemetry,
  options: ShutdownOptions
): Promise<void> {
  const { signal, timeout = DRAIN_TIMEOUT_MS } = options;

  console.log(`[shutdown] Received ${signal}, starting graceful shutdown...`);

  // Transition to DRAINING state (stops accepting new requests)
  if (!state.transition('DRAINING')) {
    console.log('[shutdown] Already draining or stopped');
    return;
  }

  // Stop accepting new connections from clients
  server.close((err) => {
    if (err) {
      console.error('[shutdown] Error closing server:', err);
    } else {
      console.log('[shutdown] Server closed');
    }
  });

  // Wait for active requests to complete or timeout
  const drainStart = Date.now();
  await waitForDrain(telemetry, timeout, () => {
    const elapsed = Date.now() - drainStart;
    const snapshot = telemetry.getSnapshot();
    console.log(
      `[shutdown] Draining... (${elapsed}ms, ${snapshot.requestsActive} active requests)`
    );
  });

  // Clean up telemetry (clears monitoring intervals)
  telemetry.shutdown();

  // Transition to STOPPING state
  state.transition('STOPPING');
  console.log('[shutdown] Graceful shutdown complete');

  // Exit process cleanly
  process.exit(0);
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
async function waitForDrain(
  telemetry: Telemetry,
  timeoutMs: number,
  onTick: () => void
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    // Check active request count from telemetry
    const snapshot = telemetry.getSnapshot();
    if (snapshot.requestsActive === 0) {
      console.log('[shutdown] All active requests completed');
      return;
    }

    // Wait a bit before checking again
    await sleep(DRAIN_CHECK_INTERVAL_MS);
    onTick();
  }

  console.warn(
    `[shutdown] Drain timeout exceeded, forcing shutdown with ${telemetry.getSnapshot().requestsActive} active requests`
  );
}

/**
 * Sleeps for the specified duration.
 *
 * Simple Promise-based sleep utility for use with async/await.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
function sleep(ms: number): Promise<void> {
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
export function setupSignalHandlers(
  server: Server,
  state: StateManager,
  telemetry: Telemetry
): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  // Normal shutdown signals
  signals.forEach(signal => {
    process.on(signal, () => {
      gracefulShutdown(server, state, telemetry, { signal }).catch(err => {
        console.error('[shutdown] Fatal error during shutdown:', err);
        process.exit(1);
      });
    });
  });

  // Uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('[fatal] Uncaught exception:', err);
    gracefulShutdown(server, state, telemetry, { signal: 'uncaughtException', timeout: 5000 }).catch(() => {
      process.exit(1);
    });
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    console.error('[fatal] Unhandled rejection:', reason);
    gracefulShutdown(server, state, telemetry, { signal: 'unhandledRejection', timeout: 5000 }).catch(() => {
      process.exit(1);
    });
  });
}
