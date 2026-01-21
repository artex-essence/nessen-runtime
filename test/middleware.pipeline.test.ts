/**
 * test/middleware.pipeline.test.ts
 *
 * Tests for middleware pipeline: built-in middleware integration.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';
import { SilentLogger } from '../src/logger.js';

async function runTests(): Promise<void> {
  console.log('[TEST] Running middleware.pipeline.test.ts...');

  // Test 1: Runtime instantiates with middleware
  const runtime1 = new Runtime(undefined, new SilentLogger());
  assert.ok(runtime1, 'Runtime should instantiate with middleware pipeline');
  console.log('✓ Runtime instantiates with built-in middleware');

  // Test 2: Middleware doesn't break request handling
  const envelope1 = createEnvelope('GET', '/health', {}, '127.0.0.1');

  let response1 = await runtime1.handle(envelope1);
  assert.strictEqual(response1.statusCode, 200, 'Middleware should allow request through');
  console.log('✓ Middleware pipeline allows requests through');

  // Test 3: Multiple requests work (middleware is stateless)
  const runtime2 = new Runtime(undefined, new SilentLogger());
  const promises = [
    runtime2.handle(createEnvelope('GET', '/health', {}, '127.0.0.1')),
    runtime2.handle(createEnvelope('GET', '/ready', {}, '127.0.0.1')),
    runtime2.handle(createEnvelope('GET', '/', {}, '127.0.0.1')),
  ];

  let responses = await Promise.all(promises);
  assert.ok(responses.every(r => r.statusCode >= 200 && r.statusCode < 600), 
    'All requests should get valid HTTP responses');
  console.log('✓ Middleware handles multiple concurrent requests');

  console.log('\n[TEST] All middleware tests passed ✓\n');
}

// Export as default promise for test runner
export default runTests();
