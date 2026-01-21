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
export declare function gracefulShutdown(server: Server, state: StateManager, telemetry: Telemetry, options: ShutdownOptions): Promise<void>;
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
export declare function setupSignalHandlers(server: Server, state: StateManager, telemetry: Telemetry): void;
//# sourceMappingURL=shutdown.d.ts.map