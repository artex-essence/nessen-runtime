/**
 * test/runtime.lifecycle.test.ts
 *
 * Tests for runtime lifecycle: initialization, ready state, and state management.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';
import { SilentLogger } from '../src/logger.js';

async function runTests(): Promise<void> {
  console.log('[TEST] Running runtime.lifecycle.test.ts...');

  // Test 1: Runtime initializes to READY state immediately
  const runtime1 = new Runtime(undefined, new SilentLogger());
  const state1 = runtime1.getState().current; // getter, not method
  assert.strictEqual(state1, 'READY', 'Runtime should be in READY state after construction');
  console.log('✓ Runtime initializes to READY immediately (no timer)');

  // Test 2: Runtime can handle requests when READY
  const runtime2 = new Runtime(undefined, new SilentLogger());
  const envelope = createEnvelope('GET', '/health', {}, '127.0.0.1');

  let response = await runtime2.handle(envelope);
  assert.strictEqual(response.statusCode, 200, 'Health check should return 200');
  console.log('✓ Runtime handles requests when READY');

  // Test 3: State transitions are valid
  const runtime3 = new Runtime(undefined, new SilentLogger());
  const stateManager = runtime3.getState();
  assert.ok(stateManager.transition('DRAINING'), 'Should transition from READY to DRAINING');
  assert.strictEqual(stateManager.current, 'DRAINING', 'State should be DRAINING');
  assert.ok(!stateManager.transition('READY'), 'Should not transition from DRAINING back to READY');
  console.log('✓ State transitions follow valid rules');

  console.log('\n[TEST] All lifecycle tests passed ✓\n');
}

// Export as default promise for test runner
export default runTests();
