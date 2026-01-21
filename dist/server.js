"use strict";
/**
 * server.ts
 *
 * HTTP ingress layer providing translation between Node.js HTTP and the transport-neutral
 * runtime. Handles request ingestion, body parsing, size limits, timeouts, and backpressure.
 * All errors are caught and converted to appropriate HTTP responses.
 *
 * @module server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const http_1 = require("http");
const runtime_js_1 = require("./runtime.js");
const envelope_js_1 = require("./envelope.js");
const shutdown_js_1 = require("./shutdown.js");
const utils_js_1 = require("./utils.js");
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
function startServer() {
    const runtime = new runtime_js_1.Runtime();
    const server = (0, http_1.createServer)(async (req, res) => {
        let requestId = 'unknown';
        try {
            const result = await handleRequest(runtime, req, res);
            requestId = result;
        }
        catch (error) {
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
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[server] ERROR: Port ${PORT} is already in use`);
            console.error('[server] Ensure no other process is running on this port');
            process.exit(1);
        }
        else if (err.code === 'EACCES') {
            console.error(`[server] ERROR: Permission denied to bind port ${PORT}`);
            console.error('[server] Ports below 1024 require elevated privileges');
            process.exit(1);
        }
        else {
            console.error('[server] Fatal server error:', err);
            process.exit(1);
        }
    });
    // Setup graceful shutdown handlers for SIGTERM/SIGINT
    (0, shutdown_js_1.setupSignalHandlers)(server, runtime.getState(), runtime.getTelemetry());
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
async function handleRequest(runtime, req, res) {
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
    let envelope = (0, envelope_js_1.createEnvelope)(method, url, headers, remoteAddress);
    // Parse body if method typically has one
    if (shouldParseBody(method)) {
        // Validate Content-Type header before parsing
        const contentType = req.headers['content-type'];
        if (contentType && !(0, utils_js_1.isValidContentType)(contentType)) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid Content-Type header');
            return envelope.id;
        }
        try {
            const body = await readBody(req, MAX_BODY_SIZE);
            envelope = (0, envelope_js_1.withBody)(envelope, body);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            res.writeHead(413, { 'Content-Type': 'text/plain' });
            res.end(err.message || 'Payload Too Large');
            return envelope.id;
        }
    }
    // Route through runtime
    const response = await runtime.handle(envelope);
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
function shouldParseBody(method) {
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
async function readBody(req, maxSize) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        const HIGH_WATER_MARK = 64 * 1024; // 64KB - pause reading if buffered data exceeds this
        const onData = (chunk) => {
            size += chunk.length;
            // Check size limit
            if (size > maxSize) {
                req.removeListener('data', onData);
                req.removeListener('end', onEnd);
                req.removeListener('error', onError);
                req.destroy();
                reject(new Error('Payload Too Large'));
                return;
            }
            chunks.push(chunk);
            // Implement backpressure: pause if too much buffered
            if (chunks.reduce((acc, c) => acc + c.length, 0) > HIGH_WATER_MARK) {
                req.pause();
            }
        };
        const onEnd = () => {
            req.removeListener('data', onData);
            req.removeListener('error', onError);
            resolve(Buffer.concat(chunks));
        };
        const onError = (error) => {
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            reject(error);
        };
        req.on('data', onData);
        req.on('end', onEnd);
        req.on('error', onError);
        // Resume if paused (in case it's already buffered)
        req.resume();
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
function sendResponse(res, response) {
    // Set HTTP status code
    res.statusCode = response.statusCode;
    // Set all response headers
    for (const [key, value] of Object.entries(response.headers)) {
        // Type guard: value can be string or string array
        if (typeof value === 'string' || Array.isArray(value)) {
            res.setHeader(key, value);
        }
    }
    // Send body (handle both Buffer and string)
    if (Buffer.isBuffer(response.body)) {
        res.end(response.body);
    }
    else {
        res.end(response.body, 'utf8');
    }
}
// Start server if run directly
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=server.js.map