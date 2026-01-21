#!/usr/bin/env node

/**
 * Test Runner - Discovers and executes all tests in dist-test/test/*.js
 * No hardcoded paths, no manual updates needed when tests are added.
 */

const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'dist-test', 'test');

async function runTests() {
  if (!fs.existsSync(testDir)) {
    console.error(`❌ Test directory not found: ${testDir}`);
    console.error('   Run `npm run build` first to compile tests.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(testDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  if (files.length === 0) {
    console.error(`❌ No test files found in ${testDir}`);
    process.exit(1);
  }

  console.log(`\n🧪 Running ${files.length} test suite(s)...\n`);

  let passed = 0;
  let failed = 0;
  const errors = [];

  for (const file of files) {
    const testPath = path.join(testDir, file);
    try {
      require(testPath);
      passed++;
    } catch (err) {
      failed++;
      errors.push({ file, error: err });
      console.error(`\n❌ ${file} failed:`);
      console.error(err.message);
      if (err.stack) {
        console.error(err.stack);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Passed: ${passed}/${files.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${files.length}`);
  }
  console.log(`${'='.repeat(80)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
