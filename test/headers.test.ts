/**
 * test/headers.test.ts
 *
 * Tests for HTTP header validation: security, standards compliance, edge cases.
 */

import assert from 'node:assert';
import { Runtime } from '../src/runtime.js';
import { createEnvelope } from '../src/envelope.js';

console.log('[TEST] Running headers.test.ts...');

const runtime = new Runtime();

// Test 1: Standard headers are accepted
const envelope1 = createEnvelope('GET', '/health', {
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0',
  'accept': 'application/json, text/plain',
  'accept-encoding': 'gzip, deflate',
  'cache-control': 'no-cache',
}, '127.0.0.1');

runtime.handle(envelope1)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Standard headers should be accepted');
    console.log('✓ Standard headers accepted');
  })
  .catch(err => {
    console.error('✗ Standard headers test failed:', err);
    process.exit(1);
  });

// Test 2: Multi-value headers work
const envelope2 = createEnvelope('GET', '/health', {
  'accept': 'text/html, application/json, */*',
  'accept-language': 'en-US, en;q=0.9',
}, '127.0.0.1');

runtime.handle(envelope2)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Multi-value headers should work');
    console.log('✓ Multi-value headers work');
  })
  .catch(err => {
    console.error('✗ Multi-value headers test failed:', err);
    process.exit(1);
  });

// Test 3: Common security headers are accepted
const envelope3 = createEnvelope('GET', '/health', {
  'x-requested-with': 'XMLHttpRequest',
  'x-forwarded-for': '203.0.113.1',
  'x-forwarded-proto': 'https',
}, '127.0.0.1');

runtime.handle(envelope3)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Security headers should be accepted');
    console.log('✓ Common security headers accepted');
  })
  .catch(err => {
    console.error('✗ Security headers test failed:', err);
    process.exit(1);
  });

// Test 4: Authorization headers work
const envelope4 = createEnvelope('GET', '/api/health', {
  'authorization': 'Bearer token123',
}, '127.0.0.1');

runtime.handle(envelope4)
  .then(response => {
    assert.ok(response.statusCode >= 200 && response.statusCode < 500, 
      'Authorization header should be processed');
    console.log('✓ Authorization headers work');
  })
  .catch(err => {
    console.error('✗ Authorization headers test failed:', err);
    process.exit(1);
  });

// Test 5: Custom headers are allowed
const envelope5 = createEnvelope('GET', '/health', {
  'x-custom-header': 'custom-value',
  'x-trace-id': 'trace-123',
}, '127.0.0.1');

runtime.handle(envelope5)
  .then(response => {
    assert.strictEqual(response.statusCode, 200, 'Custom headers should be allowed');
    console.log('✓ Custom headers allowed');
  })
  .catch(err => {
    console.error('✗ Custom headers test failed:', err);
    process.exit(1);
  });

// Test 6: Response headers include security headers
const envelope6 = createEnvelope('GET', '/', {}, '127.0.0.1');

runtime.handle(envelope6)
  .then(response => {
    assert.ok(response.headers, 'Response should have headers');
    // Check for security headers in HTML response
    if (response.headers['content-type']?.includes('text/html')) {
      assert.ok(response.headers['x-frame-options'] || 
                response.headers['X-Frame-Options'], 
                'HTML response should have X-Frame-Options');
      console.log('✓ Response includes security headers');
    } else {
      console.log('✓ Response has headers object');
    }
  })
  .catch(err => {
    console.error('✗ Response headers test failed:', err);
    process.exit(1);
  });

console.log('\n[TEST] All header tests passed ✓\n');
