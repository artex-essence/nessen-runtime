/**
 * server.ts
 * HTTP ingress layer. Creates Node HTTP server, translates to/from RequestEnvelope.
 * Handles body parsing, size limits, timeouts. Wires up shutdown handlers.
 */
import { type Server } from 'http';
/**
 * Start HTTP server with runtime.
 */
export declare function startServer(): Server;
//# sourceMappingURL=server.d.ts.map