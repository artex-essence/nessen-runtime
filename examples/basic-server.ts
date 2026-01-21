/**
 * examples/basic-server.ts
 *
 * Example of embedding nessen-runtime in your application.
 * Shows how to properly handle signals and control process exit.
 */

import { Runtime } from '../src/runtime.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { createEnvelope, withBody } from '../src/envelope.js';
import { setupSignalHandlers } from '../src/shutdown.js';
import { createConfig, type RuntimeConfig } from '../src/config.js';
import { ConsoleLogger } from '../src/logger.js';

const CONFIG: RuntimeConfig = createConfig();
const logger = new ConsoleLogger();

/**
 * Example: Basic embedded server
 */
async function main() {
  console.log('[example] Starting basic server...');

  // Create runtime instance
  const runtime = new Runtime(CONFIG);

  // Create HTTP server
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      // Convert HTTP request to envelope
      const method = req.method || 'GET';
      const url = req.url || '/';
      const headers = req.headers;
      const remoteAddress = req.socket.remoteAddress;

      let envelope = createEnvelope(method, url, headers, remoteAddress);

      // Read body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        envelope = withBody(envelope, body);
      }

      // Handle through runtime
      const response = await runtime.handle(envelope);

      // Send response
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
    } catch (error) {
      console.error('[example] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  // Setup graceful shutdown
  setupSignalHandlers(
    server,
    runtime.getState(),
    runtime.getTelemetry(),
    logger,
    (result, exitCode) => {
      console.log('[example] Shutdown complete:', result);
      process.exit(exitCode);
    },
    { shutdownTimeoutMs: CONFIG.shutdownTimeoutMs }
  );

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
