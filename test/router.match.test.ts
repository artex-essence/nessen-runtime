/**
 * test/router.match.test.ts
 *
 * Tests for routing correctness using built-in routes.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';
import { SilentLogger } from '../src/logger.js';

async function runTests(): Promise<void> {
  console.log('[TEST] Running router.match.test.ts...');

  const runtime = new Runtime(undefined, new SilentLogger());

  // Test 1: Exact path match (built-in health route)
  const envelope1 = createEnvelope('GET', '/health', {}, '127.0.0.1');

  let response1 = await runtime.handle(envelope1);
  assert.strictEqual(response1.statusCode, 200, 'Exact match should return 200');
  console.log('✓ Exact path routing works');

  // Test 2: Root path
  const envelope2 = createEnvelope('GET', '/', {}, '127.0.0.1');

  let response2 = await runtime.handle(envelope2);
  assert.strictEqual(response2.statusCode, 200, 'Root route should return 200');
  console.log('✓ Root path routing works');

  // Test 3: Readiness check
  const envelope3 = createEnvelope('GET', '/ready', {}, '127.0.0.1');

  let response3 = await runtime.handle(envelope3);
  assert.ok(response3.statusCode === 200 || response3.statusCode === 503, 
    'Ready route should return 200 (ready) or 503 (not ready)');
  console.log('✓ Readiness check routing works');

  // Test 4: 404 for unknown routes
  const envelope4 = createEnvelope('GET', '/unknown', {}, '127.0.0.1');

  let response4 = await runtime.handle(envelope4);
  assert.strictEqual(response4.statusCode, 404, 'Unknown route should return 404');
  console.log('✓ 404 for unknown routes');

  console.log('\n[TEST] All routing tests passed ✓\n');
}

// Export as default promise for test runner
export default runTests();
