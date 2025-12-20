"use strict";
/**
 * server.ts
 * HTTP ingress layer. Creates Node HTTP server, translates to/from RequestEnvelope.
 * Handles body parsing, size limits, timeouts. Wires up shutdown handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const http_1 = require("http");
const runtime_js_1 = require("./runtime.js");
const envelope_js_1 = require("./envelope.js");
const shutdown_js_1 = require("./shutdown.js");
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE || '1048576', 10); // 1MB default
const MAX_URL_LENGTH = 8192; // 8KB URL limit
const IDLE_TIMEOUT_MS = 60000; // 60 seconds idle timeout
/**
 * Start HTTP server with runtime.
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
    // Set timeouts
    server.timeout = IDLE_TIMEOUT_MS;
    server.keepAliveTimeout = IDLE_TIMEOUT_MS;
    server.headersTimeout = 10000; // 10 seconds for headers
    // Setup graceful shutdown
    (0, shutdown_js_1.setupSignalHandlers)(server, runtime.getState());
    // Start listening
    server.listen(PORT, HOST, () => {
        console.log(`[server] Listening on http://${HOST}:${PORT}`);
        console.log(`[server] Base path: ${process.env.BASE_PATH || '/'}`);
        console.log(`[server] Max body size: ${MAX_BODY_SIZE} bytes`);
    });
    return server;
}
/**
 * Handle individual HTTP request.
 * Returns request ID for logging.
 */
async function handleRequest(runtime, req, res) {
    // Security: check URL length
    const url = req.url || '/';
    if (url.length > MAX_URL_LENGTH) {
        res.writeHead(414, { 'Content-Type': 'text/plain' });
        res.end('URI Too Long');
        return 'url-too-long';
    }
    // Create envelope
    const method = req.method || 'GET';
    const headers = req.headers;
    const remoteAddress = req.socket.remoteAddress;
    let envelope = (0, envelope_js_1.createEnvelope)(method, url, headers, remoteAddress);
    // Parse body if present
    if (shouldParseBody(method)) {
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
    // Handle via runtime
    const response = await runtime.handle(envelope);
    // Send response
    sendResponse(res, response);
    return envelope.id;
}
/**
 * Check if method should parse body.
 */
function shouldParseBody(method) {
    return ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
}
/**
 * Read request body with size limit.
 */
async function readBody(req, maxSize) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > maxSize) {
                req.destroy();
                reject(new Error('Payload Too Large'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        req.on('error', (error) => {
            reject(error);
        });
    });
}
/**
 * Send RuntimeResponse to HTTP response.
 */
function sendResponse(res, response) {
    // Set status code
    res.statusCode = response.statusCode;
    // Set headers
    for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
    }
    // Send body
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