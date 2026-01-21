/**
 * test/validation.test.ts
 *
 * Tests for request validation: headers, body size, URL length.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';
import { validateConfig, createConfig, DEFAULT_CONFIG } from '../src/config.js';

console.log('[TEST] Running validation.test.ts...');

// Test 1: Config validation
try {
  validateConfig(DEFAULT_CONFIG);
  console.log('✓ Default config is valid');
} catch (err) {
  console.error('✗ Default config validation failed:', err);
  process.exit(1);
}

// Test 2: Config validation rejects invalid values
try {
  const badConfig = createConfig({ maxBodySize: -1 });
  validateConfig(badConfig);
  console.error('✗ Should have rejected negative maxBodySize');
  process.exit(1);
} catch (err) {
  console.log('✓ Config validation rejects invalid values');
}

// Test 3: Config validation rejects excessive body size
try {
  const badConfig = createConfig({ maxBodySize: 200 * 1024 * 1024 }); // 200MB
  validateConfig(badConfig);
  console.error('✗ Should have rejected excessive maxBodySize');
  process.exit(1);
} catch (err) {
  console.log('✓ Config validation rejects excessive body size');
}

// Test 4: Config validation rejects bad rate limit window
try {
  const badConfig = createConfig({ rateLimitWindowMs: 500 });
  validateConfig(badConfig);
  console.error('✗ Should have rejected short rateLimitWindowMs');
  process.exit(1);
} catch (err) {
  console.log('✓ Config validation rejects short rateLimitWindowMs');
}

// Test 5: Config validation rejects small response size
try {
  const badConfig = createConfig({ maxResponseSize: 512 });
  validateConfig(badConfig);
  console.error('✗ Should have rejected tiny maxResponseSize');
  process.exit(1);
} catch (err) {
  console.log('✓ Config validation rejects tiny maxResponseSize');
}

// Test 6: Empty body handling
const runtime1 = new Runtime();
const emptyEnvelope = createEnvelope('GET', '/health', {}, '127.0.0.1');
// GET requests typically have no body

runtime1.handle(emptyEnvelope)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Empty body should succeed');
    console.log('✓ Empty body handling works');
  })
  .catch(err => {
    console.error('✗ Empty body test failed:', err);
    process.exit(1);
  });

// Test 7: Valid headers pass validation
const runtime2 = new Runtime();
const validHeadersEnvelope = createEnvelope('GET', '/health', {
  'content-type': 'application/json',
  'user-agent': 'test-client',
  'accept': 'application/json',
}, '127.0.0.1');

runtime2.handle(validHeadersEnvelope)
  .then(response => {
    assert.ok(response.statusCode === 200, 'Valid headers should succeed');
    console.log('✓ Valid headers pass validation');
  })
  .catch(err => {
    console.error('✗ Valid headers test failed:', err);
    process.exit(1);
  });

// Test 8: Config merging works
const customConfig = createConfig({ port: 8080, trustProxy: true, rateLimitMaxRequests: 50 });
assert.strictEqual(customConfig.port, 8080, 'Should override port');
assert.strictEqual(customConfig.trustProxy, true, 'Should override trustProxy');
assert.strictEqual(customConfig.maxBodySize, DEFAULT_CONFIG.maxBodySize, 'Should keep default');
assert.strictEqual(customConfig.rateLimitMaxRequests, 50, 'Should override rateLimitMaxRequests');
console.log('✓ Config merging works');

console.log('\n[TEST] All validation tests passed ✓\n');
