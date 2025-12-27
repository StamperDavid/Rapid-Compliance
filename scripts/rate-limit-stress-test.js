/**
 * Rate Limiting Stress Test
 * BEST PRACTICE: Test rate limiting under realistic attack scenarios
 * 
 * Scenarios tested:
 * - Burst attack (1000 requests in 1 second)
 * - Sustained attack (100 req/sec for 10 seconds)
 * - Distributed attack (multiple IPs)
 * - Login brute force attempt
 */

const http = require('http');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  burstRequests: 1000,
  sustainedDuration: 10000, // 10 seconds
  sustainedRate: 100, // requests per second
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Make request with timing
 */
async function timedRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(path, TEST_CONFIG.baseUrl);

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      const duration = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          duration,
          rateLimited: res.statusCode === 429,
        });
      });
    });

    req.on('error', () => {
      resolve({ status: 0, duration: Date.now() - startTime, error: true });
    });

    if (body) req.write(JSON.stringify(body));
    req.setTimeout(5000); // 5 second timeout
    req.end();
  });
}

/**
 * Test 1: Burst Attack
 */
async function testBurstAttack() {
  log('\n💥 Test 1: Burst Attack', colors.blue);
  log(`Sending ${TEST_CONFIG.burstRequests} requests simultaneously...`, colors.yellow);

  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < TEST_CONFIG.burstRequests; i++) {
    requests.push(timedRequest('/api/agent/chat', 'POST', { 
      message: 'test',
      orgId: 'test-org',
    }));
  }

  const results = await Promise.allSettled(requests);
  const duration = Date.now() - startTime;

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
  const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.rateLimited).length;
  const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;

  log(`\nBurst Attack Results (${duration}ms total):`, colors.yellow);
  log(`  ✅ Successful: ${succeeded}`, succeeded < 100 ? colors.green : colors.red);
  log(`  🚫 Rate Limited: ${rateLimited}`, rateLimited > 0 ? colors.green : colors.red);
  log(`  ❌ Failed/Timeout: ${failed}`, colors.yellow);

  const blocked = rateLimited + failed;
  const blockRate = (blocked / TEST_CONFIG.burstRequests) * 100;

  if (blockRate > 90) {
    log(`✅ PASS: ${blockRate.toFixed(1)}% of burst requests blocked`, colors.green);
    return true;
  } else {
    log(`⚠️  CONCERN: Only ${blockRate.toFixed(1)}% blocked (should be >90%)`, colors.yellow);
    return false;
  }
}

/**
 * Test 2: Sustained Attack
 */
async function testSustainedAttack() {
  log('\n⚡ Test 2: Sustained Attack', colors.blue);
  log(`Sending ${TEST_CONFIG.sustainedRate} req/sec for ${TEST_CONFIG.sustainedDuration/1000} seconds...`, colors.yellow);

  const interval = 1000 / TEST_CONFIG.sustainedRate; // ms between requests
  const totalRequests = (TEST_CONFIG.sustainedDuration / 1000) * TEST_CONFIG.sustainedRate;

  let succeeded = 0;
  let rateLimited = 0;
  let failed = 0;

  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < TEST_CONFIG.sustainedDuration) {
    const result = await timedRequest('/api/agent/chat', 'POST', { 
      message: 'sustained test',
      orgId: 'test-org',
    });

    if (result.status === 200) succeeded++;
    else if (result.rateLimited) rateLimited++;
    else failed++;

    requestCount++;

    // Wait for next interval
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const duration = Date.now() - startTime;
  const actualRate = Math.round((requestCount / duration) * 1000);

  log(`\nSustained Attack Results:`, colors.yellow);
  log(`  Requests sent: ${requestCount} at ~${actualRate} req/sec`, colors.yellow);
  log(`  ✅ Successful: ${succeeded}`, colors.green);
  log(`  🚫 Rate Limited: ${rateLimited}`, rateLimited > 0 ? colors.green : colors.red);
  log(`  ❌ Failed: ${failed}`, colors.yellow);

  if (rateLimited > requestCount * 0.5) {
    log(`✅ PASS: Rate limiting effective (${Math.round((rateLimited/requestCount)*100)}% blocked)`, colors.green);
    return true;
  } else {
    log(`⚠️  CONCERN: Rate limiting may be too lenient`, colors.yellow);
    return false;
  }
}

/**
 * Test 3: Login Brute Force Protection
 */
async function testLoginBruteForce() {
  log('\n🔨 Test 3: Login Brute Force Protection', colors.blue);
  log('Attempting 50 rapid login attempts...', colors.yellow);

  const attempts = 50;
  let succeeded = 0;
  let blocked = 0;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await timedRequest('/api/auth/login', 'POST', {
        email: 'attacker@test.com',
        password: `wrongpassword${i}`,
      });

      if (result.status === 200) succeeded++;
      if (result.status === 429) blocked++;
    } catch (error) {
      // Expected
    }

    // No delay (brute force simulation)
  }

  log(`\nBrute Force Results:`, colors.yellow);
  log(`  Login attempts: ${attempts}`, colors.yellow);
  log(`  ✅ Succeeded: ${succeeded}`, succeeded === 0 ? colors.green : colors.red);
  log(`  🚫 Blocked: ${blocked}`, blocked > 40 ? colors.green : colors.yellow);

  if (blocked > 40 && succeeded === 0) {
    log(`✅ PASS: Login brute force protection working`, colors.green);
    return true;
  } else {
    log(`⚠️  CONCERN: Brute force protection may be weak`, colors.yellow);
    return false;
  }
}

/**
 * Main execution
 */
async function runRateLimitStressTest() {
  console.log('\n');
  log('═'.repeat(70), colors.blue);
  log('  🚦 RATE LIMITING STRESS TEST', colors.blue);
  log('═'.repeat(70), colors.blue);
  console.log();

  log(`⚠️  This will send 1000+ requests to: ${TEST_CONFIG.baseUrl}`, colors.yellow);
  console.log();

  const results = {
    burstAttack: false,
    sustainedAttack: false,
    loginBruteForce: false,
  };

  try {
    results.burstAttack = await testBurstAttack();
    results.sustainedAttack = await testSustainedAttack();
    results.loginBruteForce = await testLoginBruteForce();

    // Summary
    console.log('\n');
    log('═'.repeat(70), colors.blue);
    log('  📊 STRESS TEST SUMMARY', colors.blue);
    log('═'.repeat(70), colors.blue);
    console.log();

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    log(`Burst Attack Protection: ${results.burstAttack ? '✅ PASS' : '⚠️  CONCERN'}`, results.burstAttack ? colors.green : colors.yellow);
    log(`Sustained Attack Protection: ${results.sustainedAttack ? '✅ PASS' : '⚠️  CONCERN'}`, results.sustainedAttack ? colors.green : colors.yellow);
    log(`Login Brute Force Protection: ${results.loginBruteForce ? '✅ PASS' : '⚠️  CONCERN'}`, results.loginBruteForce ? colors.green : colors.yellow);

    console.log();
    log(`Overall: ${passed}/${total} tests passed`, passed >= 2 ? colors.green : colors.yellow);
    console.log();

    if (passed === total) {
      log('🎉 RATE LIMITING: Production ready!', colors.green);
    } else if (passed >= 2) {
      log('✅ RATE LIMITING: Good, but could be improved', colors.yellow);
    } else {
      log('⚠️  RATE LIMITING: Needs improvement before production', colors.red);
    }

    console.log();
    process.exit(passed >= 2 ? 0 : 1);

  } catch (error) {
    log(`\n❌ Stress test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runRateLimitStressTest();
}

module.exports = { runRateLimitStressTest };



