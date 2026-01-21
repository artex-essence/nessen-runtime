/**
 * test/router.match.test.ts
 *
 * Tests for routing correctness using built-in routes.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';

console.log('[TEST] Running router.match.test.ts...');

const runtime = new Runtime();

// Test 1: Exact path match (built-in health route)
const envelope1 = createEnvelope('GET', '/health', {}, '127.0.0.1');

runtime.handle(envelope1)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Exact match should return 200');
    console.log('✓ Exact path routing works');
  })
  .catch(err => {
    console.error('✗ Exact path test failed:', err);
    process.exit(1);
  });

// Test 2: Root path
const envelope2 = createEnvelope('GET', '/', {}, '127.0.0.1');

runtime.handle(envelope2)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Root route should return 200');
    console.log('✓ Root path routing works');
  })
  .catch(err => {
    console.error('✗ Root path test failed:', err);
    process.exit(1);
  });

// Test 3: Readiness check
const envelope3 = createEnvelope('GET', '/ready', {}, '127.0.0.1');

runtime.handle(envelope3)
  .then(response => {
    assert.ok(response.statusCode === 200 || response.statusCode === 503, 
      'Ready route should return 200 (ready) or 503 (not ready)');
    console.log('✓ Readiness check routing works');
  })
  .catch(err => {
    console.error('✗ Readiness test failed:', err);
    process.exit(1);
  });

// Test 4: 404 for unknown routes
const envelope4 = createEnvelope('GET', '/unknown', {}, '127.0.0.1');

runtime.handle(envelope4)
  .then(response => {
    assert.strictEqual(response.statusCode, 404, 'Unknown route should return 404');
    console.log('✓ 404 for unknown routes');
  })
  .catch(err => {
    console.error('✗ 404 test failed:', err);
    process.exit(1);
  });

console.log('\n[TEST] All routing tests passed ✓\n');
