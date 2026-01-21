/**
 * server.ts
 *
 * HTTP ingress layer providing translation between Node.js HTTP and the transport-neutral
 * runtime. Handles request ingestion, body parsing, size limits, timeouts, and backpressure.
 * All errors are caught and converted to appropriate HTTP responses.
 *
 * @module server
 */
import { type Server } from 'http';
/**
 * Starts the HTTP server and wires up all listeners.
 *
 * Creates the Runtime instance (singleton), configures timeouts for socket management,
 * sets up signal handlers for graceful shutdown, and begins listening for connections.
 * Includes error handler to catch EADDRINUSE and other server-level errors.
 *
 * @returns The Node.js HTTP Server instance (useful for testing/shutdown)
 */
export declare function startServer(): Server;
//# sourceMappingURL=server.d.ts.map