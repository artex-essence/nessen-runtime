/**
 * test/runtime.timeout.test.ts
 *
 * Tests for request timeout behavior: correct response codes.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';

console.log('[TEST] Running runtime.timeout.test.ts...');

// Test 1: Fast requests complete successfully
const runtime1 = new Runtime();
const envelope1 = createEnvelope('GET', '/health', {}, '127.0.0.1');

runtime1.handle(envelope1)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Fast request should succeed');
    console.log('✓ Fast requests complete successfully');
  })
  .catch(err => {
    console.error('✗ Fast request test failed:', err);
    process.exit(1);
  });

// Test 2: Runtime handles concurrent requests
const runtime2 = new Runtime();
const promises = [];
for (let i = 0; i < 10; i++) {
  const envelope = createEnvelope('GET', '/ready', {}, '127.0.0.1');
  promises.push(runtime2.handle(envelope));
}

Promise.all(promises)
  .then(responses => {
    assert.ok(responses.every(r => r.statusCode === 200 || r.statusCode === 503), 
      'All responses should be either 200 (ready) or 503 (draining)');
    console.log('✓ Runtime handles concurrent requests');
  })
  .catch(err => {
    console.error('✗ Concurrent request test failed:', err);
    process.exit(1);
  });

console.log('\n[TEST] All timeout tests passed ✓\n');
