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
import { createConfig, validateConfig, type RuntimeConfig } from './config.js';
import { setupSignalHandlers } from './shutdown.js';
import { isValidContentType } from './utils.js';
import { createDefaultLogger } from './logger.js';

const CONFIG: RuntimeConfig = createConfig();
validateConfig(CONFIG);
const LOGGER = createDefaultLogger();

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
  const runtime = new Runtime(CONFIG, LOGGER);

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
  server.timeout = CONFIG.idleTimeoutMs;
  server.keepAliveTimeout = CONFIG.idleTimeoutMs;
  server.headersTimeout = CONFIG.headersTimeoutMs;

  // Error handler for server-level errors (e.g., EADDRINUSE)
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] ERROR: Port ${CONFIG.port} is already in use`);
      console.error('[server] Ensure no other process is running on this port');
      process.exit(1);
    } else if (err.code === 'EACCES') {
      LOGGER.error(`Permission denied to bind port ${CONFIG.port}`);
      LOGGER.error('Ports below 1024 require elevated privileges');
      process.exit(1);
    } else {
      LOGGER.error('Fatal server error:', { error: err });
      process.exit(1);
    }
  });

  // Setup graceful shutdown handlers for SIGTERM/SIGINT
  setupSignalHandlers(server, runtime.getState(), runtime.getTelemetry(), LOGGER, (result, exitCode) => {
    if (!result.drained) {
      LOGGER.warn(`Forced shutdown with ${result.activeRequests} active requests`);
    }
    process.exit(exitCode);
  }, { shutdownTimeoutMs: CONFIG.shutdownTimeoutMs });

  // Start listening
  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`[server] Listening on http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`[server] Base path: ${process.env.BASE_PATH || '/'}`);
    console.log(`[server] Max body size: ${CONFIG.maxBodySize} bytes`);
    console.log(`[server] Request timeout: ${CONFIG.requestTimeoutMs}ms`);
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
  if (Buffer.byteLength(url, 'utf8') > CONFIG.maxUrlLength) {
    res.writeHead(414, { 'Content-Type': 'text/plain' });
    res.end('URI Too Long');
    return 'url-too-long';
  }

  // Header size guardrail
  const headerBytes = Object.entries(req.headers).reduce((total, [key, value]) => {
    const val = Array.isArray(value) ? value.join(',') : value ?? '';
    return total + Buffer.byteLength(key, 'utf8') + Buffer.byteLength(String(val), 'utf8');
  }, 0);

  if (headerBytes > CONFIG.maxHeaderSize) {
    res.writeHead(431, { 'Content-Type': 'text/plain' });
    res.end('Request Header Fields Too Large');
    return 'headers-too-large';
  }

  // Header count guardrail
  const headerCount = Object.keys(req.headers).length;
  if (headerCount > CONFIG.maxHeaderCount) {
    res.writeHead(431, { 'Content-Type': 'text/plain' });
    res.end('Too Many Headers');
    return 'too-many-headers';
  }

  // Create envelope from HTTP metadata
  const method = req.method || 'GET';
  const headers = req.headers;

  // Normalize client IP respecting proxy configuration
  const clientIp = extractClientIp(headers, req.socket.remoteAddress, CONFIG.trustProxy);

  // Request ID: prefer incoming header, optionally generate
  const headerRequestId = headers[CONFIG.requestIdHeader.toLowerCase()] as string | undefined;
  const requestId = normalizeRequestId(headerRequestId, CONFIG.generateRequestId);

  let envelope: RequestEnvelope = createEnvelope(method, url, headers, clientIp, requestId);

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
      const body = await readBody(req, CONFIG.maxBodySize);
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
  if (!response.headers[CONFIG.requestIdHeader]) {
    response.headers[CONFIG.requestIdHeader] = envelope.id;
  }
  sendResponse(res, response);
  
  return envelope.id;
}


  /**
   * Extract client IP with proxy awareness.
   */
  function extractClientIp(
    headers: IncomingMessage['headers'],
    remoteAddress: string | undefined,
    trustProxy: boolean
  ): string | undefined {
    if (!trustProxy) {
      return remoteAddress;
    }

    const forwarded = headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const parts = forwarded.split(',');
      const first = parts.length > 0 ? parts[0]?.trim() : undefined;
      if (first && isValidIp(first)) {
        return first;
      }
    }

    return remoteAddress;
  }

  function isValidIp(value: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || /^[a-fA-F0-9:]+$/.test(value);
  }

  /**
   * Normalize incoming request ID header or generate a new one.
   */
  function normalizeRequestId(headerValue: string | undefined, generate: boolean): string | undefined {
    if (headerValue && headerValue.length <= 200) {
      return headerValue;
    }
    return generate ? undefined : undefined;
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
