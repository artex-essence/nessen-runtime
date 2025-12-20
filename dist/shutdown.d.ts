/**
 * shutdown.ts
 * Graceful shutdown: stop accepting new requests, drain active, close server.
 * Signal handling helpers.
 */
import type { Server } from 'http';
import type { StateManager } from './state.js';
export interface ShutdownOptions {
    readonly signal: string;
    readonly timeout?: number;
}
/**
 * Perform graceful shutdown sequence.
 */
export declare function gracefulShutdown(server: Server, state: StateManager, options: ShutdownOptions): Promise<void>;
/**
 * Setup signal handlers for graceful shutdown.
 */
export declare function setupSignalHandlers(server: Server, state: StateManager): void;
//# sourceMappingURL=shutdown.d.ts.map