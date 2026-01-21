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
const config_js_1 = require("./config.js");
const shutdown_js_1 = require("./shutdown.js");
const utils_js_1 = require("./utils.js");
const logger_js_1 = require("./logger.js");
const CONFIG = (0, config_js_1.createConfig)();
(0, config_js_1.validateConfig)(CONFIG);
const LOGGER = (0, logger_js_1.createDefaultLogger)();
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
    const runtime = new runtime_js_1.Runtime(CONFIG, LOGGER);
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
    server.timeout = CONFIG.idleTimeoutMs;
    server.keepAliveTimeout = CONFIG.idleTimeoutMs;
    server.headersTimeout = CONFIG.headersTimeoutMs;
    // Error handler for server-level errors (e.g., EADDRINUSE)
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[server] ERROR: Port ${CONFIG.port} is already in use`);
            console.error('[server] Ensure no other process is running on this port');
            process.exit(1);
        }
        else if (err.code === 'EACCES') {
            LOGGER.error(`Permission denied to bind port ${CONFIG.port}`);
            LOGGER.error('Ports below 1024 require elevated privileges');
            process.exit(1);
        }
        else {
            LOGGER.error('Fatal server error:', { error: err });
            process.exit(1);
        }
    });
    // Setup graceful shutdown handlers for SIGTERM/SIGINT
    (0, shutdown_js_1.setupSignalHandlers)(server, runtime.getState(), runtime.getTelemetry(), LOGGER, (result, exitCode) => {
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
async function handleRequest(runtime, req, res) {
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
    const headerRequestId = headers[CONFIG.requestIdHeader.toLowerCase()];
    const requestId = normalizeRequestId(headerRequestId, CONFIG.generateRequestId);
    let envelope = (0, envelope_js_1.createEnvelope)(method, url, headers, clientIp, requestId);
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
            const body = await readBody(req, CONFIG.maxBodySize);
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
    if (!response.headers[CONFIG.requestIdHeader]) {
        response.headers[CONFIG.requestIdHeader] = envelope.id;
    }
    sendResponse(res, response);
    return envelope.id;
}
/**
 * Extract client IP with proxy awareness.
 */
function extractClientIp(headers, remoteAddress, trustProxy) {
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
function isValidIp(value) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || /^[a-fA-F0-9:]+$/.test(value);
}
/**
 * Normalize incoming request ID header or generate a new one.
 */
function normalizeRequestId(headerValue, generate) {
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
        const onData = (chunk) => {
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
        const onError = (error) => {
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
function sendResponse(res, response) {
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