/**
 * headers.limit.test.ts
 *
 * Verifies maxHeaderCount ingress guard returns 431 when exceeded.
 */

import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

async function main(): Promise<void> {
  // Configure server to bind on random port and localhost
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';

  const { startServer } = await import('../src/server.js');

  console.log('[TEST] Running headers.limit.test.ts...');

  // Start server
  const server = startServer();
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

function makeRequest(headers: http.OutgoingHttpHeaders): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

  try {
    // Construct headers exceeding maxHeaderCount (default 100)
    const tooManyHeaders: http.OutgoingHttpHeaders = {};
    for (let i = 0; i < 120; i += 1) {
      tooManyHeaders[`x-test-header-${i}`] = '1';
    }

    const result = await makeRequest(tooManyHeaders);
    assert.strictEqual(result.status, 431, 'Expected 431 for too many headers');
    console.log('✓ maxHeaderCount guard returns 431');
  } catch (err) {
    console.error('✗ headers.limit.test failed', err);
    server.close();
    process.exit(1);
  }

  server.close();
  console.log('\n[TEST] headers.limit.test.ts passed ✓\n');
}

void main();
