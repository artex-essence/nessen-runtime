"use strict";
/**
 * examples/basic-server.ts
 *
 * Example of embedding nessen-runtime in your application.
 * Shows how to properly handle signals and control process exit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const runtime_js_1 = require("../src/runtime.js");
const http_1 = require("http");
const envelope_js_1 = require("../src/envelope.js");
const shutdown_js_1 = require("../src/shutdown.js");
const config_js_1 = require("../src/config.js");
const CONFIG = (0, config_js_1.createConfig)();
/**
 * Example: Basic embedded server
 */
async function main() {
    console.log('[example] Starting basic server...');
    // Create runtime instance
    const runtime = new runtime_js_1.Runtime(CONFIG);
    // Create HTTP server
    const server = (0, http_1.createServer)(async (req, res) => {
        try {
            // Convert HTTP request to envelope
            const method = req.method || 'GET';
            const url = req.url || '/';
            const headers = req.headers;
            const remoteAddress = req.socket.remoteAddress;
            let envelope = (0, envelope_js_1.createEnvelope)(method, url, headers, remoteAddress);
            // Read body for POST/PUT/PATCH
            if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const body = Buffer.concat(chunks);
                envelope = (0, envelope_js_1.withBody)(envelope, body);
            }
            // Handle through runtime
            const response = await runtime.handle(envelope);
            // Send response
            res.writeHead(response.statusCode, response.headers);
            res.end(response.body);
        }
        catch (error) {
            console.error('[example] Request error:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    });
    // Setup graceful shutdown
    (0, shutdown_js_1.setupSignalHandlers)(server, runtime.getState(), runtime.getTelemetry(), (result, exitCode) => {
        console.log('[example] Shutdown complete:', result);
        process.exit(exitCode);
    }, { shutdownTimeoutMs: CONFIG.shutdownTimeoutMs });
    // Start listening
    server.listen(CONFIG.port, CONFIG.host, () => {
        console.log(`[example] Server running on http://${CONFIG.host}:${CONFIG.port}`);
        console.log('[example] Press Ctrl+C to stop gracefully');
    });
}
main().catch(err => {
    console.error('[example] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=basic-server.js.map