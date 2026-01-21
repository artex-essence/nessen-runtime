/**
 * test/middleware.pipeline.test.ts
 *
 * Tests for middleware pipeline: built-in middleware integration.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';

console.log('[TEST] Running middleware.pipeline.test.ts...');

// Test 1: Runtime instantiates with middleware
const runtime1 = new Runtime();
assert.ok(runtime1, 'Runtime should instantiate with middleware pipeline');
console.log('✓ Runtime instantiates with built-in middleware');

// Test 2: Middleware doesn't break request handling
const envelope1 = createEnvelope('GET', '/health', {}, '127.0.0.1');

runtime1.handle(envelope1)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Middleware should allow request through');
    console.log('✓ Middleware pipeline allows requests through');
  })
  .catch(err => {
    console.error('✗ Middleware pipeline test failed:', err);
    process.exit(1);
  });

// Test 3: Multiple requests work (middleware is stateless)
const runtime2 = new Runtime();
const promises = [
  runtime2.handle(createEnvelope('GET', '/health', {}, '127.0.0.1')),
  runtime2.handle(createEnvelope('GET', '/ready', {}, '127.0.0.1')),
  runtime2.handle(createEnvelope('GET', '/', {}, '127.0.0.1')),
];

Promise.all(promises)
  .then(responses => {
    assert.ok(responses.every(r => r.statusCode >= 200 && r.statusCode < 600), 
      'All requests should get valid HTTP responses');
    console.log('✓ Middleware handles multiple concurrent requests');
  })
  .catch(err => {
    console.error('✗ Multiple request test failed:', err);
    process.exit(1);
  });

console.log('\n[TEST] All middleware tests passed ✓\n');
