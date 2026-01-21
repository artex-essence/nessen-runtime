/**
 * test/headers.test.ts
 *
 * Tests for HTTP header validation: security, standards compliance, edge cases.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';
import { SilentLogger } from '../src/logger.js';

async function runTests(): Promise<void> {
  console.log('[TEST] Running headers.test.ts...');

  const runtime = new Runtime(undefined, new SilentLogger());

  // Test 1: Standard headers are accepted
  const envelope1 = createEnvelope('GET', '/health', {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0',
    'accept': 'application/json, text/plain',
    'accept-encoding': 'gzip, deflate',
    'cache-control': 'no-cache',
  }, '127.0.0.1');

  let response1 = await runtime.handle(envelope1);
  assert.strictEqual(response1.statusCode, 200, 'Standard headers should be accepted');
  console.log('✓ Standard headers accepted');

  // Test 2: Multi-value headers work
  const envelope2 = createEnvelope('GET', '/health', {
    'accept': 'text/html, application/json, */*',
    'accept-language': 'en-US, en;q=0.9',
  }, '127.0.0.1');

  let response2 = await runtime.handle(envelope2);
  assert.strictEqual(response2.statusCode, 200, 'Multi-value headers should work');
  console.log('✓ Multi-value headers work');

  // Test 3: Common security headers are accepted
  const envelope3 = createEnvelope('GET', '/health', {
    'x-requested-with': 'XMLHttpRequest',
    'x-forwarded-for': '203.0.113.1',
    'x-forwarded-proto': 'https',
  }, '127.0.0.1');

  let response3 = await runtime.handle(envelope3);
  assert.strictEqual(response3.statusCode, 200, 'Security headers should be accepted');
  console.log('✓ Common security headers accepted');

  // Test 4: Authorization headers work
  const envelope4 = createEnvelope('GET', '/api/health', {
    'authorization': 'Bearer token123',
  }, '127.0.0.1');

  let response4 = await runtime.handle(envelope4);
  assert.ok(response4.statusCode >= 200 && response4.statusCode < 500, 
    'Authorization header should be processed');
  console.log('✓ Authorization headers work');

  // Test 5: Custom headers are allowed
  const envelope5 = createEnvelope('GET', '/health', {
    'x-custom-header': 'custom-value',
    'x-trace-id': 'trace-123',
  }, '127.0.0.1');

  let response5 = await runtime.handle(envelope5);
  assert.strictEqual(response5.statusCode, 200, 'Custom headers should be allowed');
  console.log('✓ Custom headers allowed');

  // Test 6: Response headers include security headers
  const envelope6 = createEnvelope('GET', '/', {}, '127.0.0.1');

  let response6 = await runtime.handle(envelope6);
  assert.ok(response6.headers, 'Response should have headers');
  // Check for security headers in HTML response
  if (response6.headers['content-type']?.includes('text/html')) {
    assert.ok(response6.headers['x-frame-options'] || 
              response6.headers['X-Frame-Options'], 
              'HTML response should have X-Frame-Options');
    console.log('✓ Response includes security headers');
  } else {
    console.log('✓ Response has headers object');
  }

  console.log('\n[TEST] All header tests passed ✓\n');
}

// Export as default promise for test runner
export default runTests();
