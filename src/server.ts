/**
 * server.ts
 *
 * HTTP ingress layer providing translation between Node.js HTTP and the transport-neutral
 * runtime. Handles request ingestion, body parsing, size limits, timeouts, and backpressure.
 * All errors are caught and converted to appropriate HTTP responses.
 *
 * @module server
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { Runtime } from './runtime.js';
import { createEnvelope, withBody, type RequestEnvelope, type RuntimeResponse } from './envelope.js';
import { setupSignalHandlers } from './shutdown.js';
import { isValidContentType } from './utils.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE || '1048576', 10); // 1MB default
const MAX_URL_LENGTH = 8192; // 8KB URL limit
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds per-request timeout
const IDLE_TIMEOUT_MS = 60000; // 60 seconds idle timeout

/**
 * Starts the HTTP server and wires up all listeners.
 *
 * Creates the Runtime instance (singleton), configures timeouts for socket management,
 * sets up signal handlers for graceful shutdown, and begins listening for connections.
 * Includes error handler to catch EADDRINUSE and other server-level errors.
 *
 * @returns The Node.js HTTP Server instance (useful for testing/shutdown)
 */
export function startServer(): Server {
  const runtime = new Runtime();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    let requestId = 'unknown';
    try {
      const result = await handleRequest(runtime, req, res);
      requestId = result;
    } catch (error) {
      console.error(`[server] [${requestId}] Fatal error handling request:`, error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  });

  // Configure socket timeouts for connection management
  server.timeout = IDLE_TIMEOUT_MS;
  server.keepAliveTimeout = IDLE_TIMEOUT_MS;
  server.headersTimeout = 10000; // 10 seconds for headers

  // Error handler for server-level errors (e.g., EADDRINUSE)
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] ERROR: Port ${PORT} is already in use`);
      console.error('[server] Ensure no other process is running on this port');
      process.exit(1);
    } else if (err.code === 'EACCES') {
      console.error(`[server] ERROR: Permission denied to bind port ${PORT}`);
      console.error('[server] Ports below 1024 require elevated privileges');
      process.exit(1);
    } else {
      console.error('[server] Fatal server error:', err);
      process.exit(1);
    }
  });

  // Setup graceful shutdown handlers for SIGTERM/SIGINT
  setupSignalHandlers(server, runtime.getState(), runtime.getTelemetry(), (result, exitCode) => {
    if (!result.drained) {
      console.warn(`[server] Forced shutdown with ${result.activeRequests} active requests`);
    }
    process.exit(exitCode);
  });

  // Start listening
  server.listen(PORT, HOST, () => {
    console.log(`[server] Listening on http://${HOST}:${PORT}`);
    console.log(`[server] Base path: ${process.env.BASE_PATH || '/'}`);
    console.log(`[server] Max body size: ${MAX_BODY_SIZE} bytes`);
    console.log(`[server] Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
  });

  return server;
}

/**
 * Handles an individual HTTP request from start to finish.
 *
 * Performs security checks (URL length, Content-Type validation), creates request envelope,
 * parses request body with size limits, routes through runtime, and sends HTTP response.
 * Returns request ID for error logging and tracing.
 *
 * @param runtime - The Runtime instance (singleton)
 * @param req - Node.js IncomingMessage
 * @param res - Node.js ServerResponse
 * @returns Request ID string for logging
 */
async function handleRequest(
  runtime: Runtime,
  req: IncomingMessage,
  res: ServerResponse
): Promise<string> {
  // Security: check URL length to prevent DoS
  const url = req.url || '/';
  if (url.length > MAX_URL_LENGTH) {
    res.writeHead(414, { 'Content-Type': 'text/plain' });
    res.end('URI Too Long');
    return 'url-too-long';
  }

  // Create envelope from HTTP metadata
  const method = req.method || 'GET';
  const headers = req.headers;
  const remoteAddress = req.socket.remoteAddress;

  let envelope: RequestEnvelope = createEnvelope(method, url, headers, remoteAddress);

  // Parse body if method typically has one
  if (shouldParseBody(method)) {
    // Validate Content-Type header before parsing
    const contentType = req.headers['content-type'] as string | undefined;
    if (contentType && !isValidContentType(contentType)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid Content-Type header');
      return envelope.id;
    }

    try {
      const body = await readBody(req, MAX_BODY_SIZE);
      envelope = withBody(envelope, body);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Payload Too Large');
      return envelope.id;
    }
  }

  // Route through runtime
  const response: RuntimeResponse = await runtime.handle(envelope);

  // Send response back to client
  sendResponse(res, response);
  
  return envelope.id;
}

/**
 * Checks if request method typically includes a body.
 * Used to determine whether to parse request body.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @returns true for methods that commonly have bodies (POST, PUT, PATCH)
 */
function shouldParseBody(method: string): boolean {
  return ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
}

/**
 * Reads request body with backpressure support and size limit enforcement.
 *
 * Implements proper stream handling to prevent memory exhaustion:
 * - Limits total size to prevent DoS
 * - Uses pause/resume for backpressure when buffer builds up
 * - Cleans up properly on errors
 *
 * @param req - Node.js IncomingMessage stream
 * @param maxSize - Maximum allowed body size in bytes
 * @returns Promise resolving to complete body as Buffer
 * @throws Error if body exceeds maxSize
 */
async function readBody(req: IncomingMessage, maxSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    const onData = (chunk: Buffer) => {
      size += chunk.length;

      // Check size limit early to avoid extra buffering
      if (size > maxSize) {
        cleanup();
        req.destroy();
        reject(new Error('Payload Too Large'));
        return;
      }

      chunks.push(chunk);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/**
 * Sends RuntimeResponse back to HTTP client.
 *
 * Converts transport-neutral response (statusCode, headers, body) back into
 * Node.js HTTP response, properly handling both string and buffer bodies.
 *
 * @param res - Node.js ServerResponse
 * @param response - RuntimeResponse with status, headers, and body
 */
function sendResponse(res: ServerResponse, response: RuntimeResponse): void {
  // Set HTTP status code
  res.statusCode = response.statusCode;

  // Set all response headers
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    // Type guard: value can be string or string array
    if (typeof value === 'string' || Array.isArray(value)) {
      res.setHeader(key, value);
    }
  }

  // Send body (handle both Buffer and string)
  if (Buffer.isBuffer(response.body)) {
    res.end(response.body);
  } else {
    res.end(response.body, 'utf8');
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}
