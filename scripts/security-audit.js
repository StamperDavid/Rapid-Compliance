/**
 * Security Audit Script
 * BEST PRACTICE: Automated security testing
 * 
 * Tests:
 * - API key exposure in responses
 * - Authentication bypass attempts
 * - Rate limiting under attack
 * - Input validation
 * - SQL/NoSQL injection attempts
 */

const https = require('https');
const http = require('http');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || 'test-api-key',
  authToken: process.env.TEST_AUTH_TOKEN || null,
};

// Colors
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
 * Make HTTP request
 */
async function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_CONFIG.baseUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonData,
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test 1: API Key Exposure Check
 */
async function testAPIKeyExposure() {
  log('\n🔐 Test 1: API Key Exposure Check', colors.blue);
  log('─'.repeat(70));

  const issues = [];

  // Test unauthenticated endpoints
  const publicEndpoints = [
    '/api/health',
    '/api/agent/chat',
    '/api/leads/enrich',
  ];

  for (const endpoint of publicEndpoints) {
    try {
      const response = await makeRequest(endpoint, 'GET');
      const bodyStr = JSON.stringify(response.body);

      // Check for exposed sensitive data
      const sensitivePatterns = [
        { pattern: /sk_live_/i, name: 'Stripe Live Key' },
        { pattern: /sk_test_/i, name: 'Stripe Test Key' },
        { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/i, name: 'SendGrid API Key' },
        { pattern: /xox[baprs]-[0-9a-zA-Z-]+/i, name: 'Slack Token' },
        { pattern: /ghp_[a-zA-Z0-9]{36}/i, name: 'GitHub Token' },
        { pattern: /AIza[0-9A-Za-z_-]{35}/i, name: 'Google API Key' },
        { pattern: /"apiKey"\s*:\s*"[^"]+"/i, name: 'Generic API Key in JSON' },
        { pattern: /"secret"\s*:\s*"[^"]+"/i, name: 'Secret in JSON' },
        { pattern: /"password"\s*:\s*"[^"]+"/i, name: 'Password in JSON' },
      ];

      for (const { pattern, name } of sensitivePatterns) {
        if (pattern.test(bodyStr)) {
          issues.push(`⚠️  ${endpoint}: Possible ${name} exposure`);
        }
      }

    } catch (error) {
      // Endpoint might not exist, that's okay
    }
  }

  if (issues.length === 0) {
    log('✅ No API keys exposed in responses', colors.green);
  } else {
    log(`❌ Found ${issues.length} potential exposures:`, colors.red);
    issues.forEach(issue => log(`   ${issue}`, colors.red));
  }

  return issues.length === 0;
}

/**
 * Test 2: Authentication Bypass Attempts
 */
async function testAuthBypass() {
  log('\n🔓 Test 2: Authentication Bypass Attempts', colors.blue);
  log('─'.repeat(70));

  const protectedEndpoints = [
    '/api/admin/users',
    '/api/admin/organizations',
    '/api/agent/config',
    '/api/outbound/sequences',
  ];

  const bypassAttempts = [];

  for (const endpoint of protectedEndpoints) {
    try {
      // Attempt 1: No auth header
      const noAuth = await makeRequest(endpoint, 'GET');
      if (noAuth.status === 200) {
        bypassAttempts.push(`${endpoint}: Accessible without authentication (${noAuth.status})`);
      }

      // Attempt 2: Invalid token
      const invalidAuth = await makeRequest(endpoint, 'GET', null, {
        'Authorization': 'Bearer invalid-token-12345',
      });
      if (invalidAuth.status === 200) {
        bypassAttempts.push(`${endpoint}: Accessible with invalid token (${invalidAuth.status})`);
      }

      // Attempt 3: Expired token (mock)
      const expiredAuth = await makeRequest(endpoint, 'GET', null, {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token',
      });
      if (expiredAuth.status === 200) {
        bypassAttempts.push(`${endpoint}: Accessible with expired token (${expiredAuth.status})`);
      }

    } catch (error) {
      // Expected to fail, that's good
    }
  }

  if (bypassAttempts.length === 0) {
    log('✅ All protected endpoints properly secured', colors.green);
  } else {
    log(`❌ Found ${bypassAttempts.length} auth bypass vulnerabilities:`, colors.red);
    bypassAttempts.forEach(attempt => log(`   ${attempt}`, colors.red));
  }

  return bypassAttempts.length === 0;
}

/**
 * Test 3: Rate Limiting Under Attack
 */
async function testRateLimiting() {
  log('\n🚦 Test 3: Rate Limiting Under Attack', colors.blue);
  log('─'.repeat(70));

  const endpoint = '/api/agent/chat';
  const requestsToSend = 100; // Try to overwhelm rate limiter
  const concurrent = 10; // Send 10 at a time

  log(`Sending ${requestsToSend} requests to ${endpoint} (${concurrent} concurrent)...`, colors.yellow);

  let successCount = 0;
  let rateLimitedCount = 0;
  let errorCount = 0;

  // Send requests in batches
  for (let i = 0; i < requestsToSend; i += concurrent) {
    const batch = [];
    
    for (let j = 0; j < concurrent && i + j < requestsToSend; j++) {
      batch.push(
        makeRequest(endpoint, 'POST', { message: 'test', orgId: 'test' })
          .then(res => {
            if (res.status === 200 || res.status === 201) successCount++;
            else if (res.status === 429) rateLimitedCount++;
            else errorCount++;
          })
          .catch(() => errorCount++)
      );
    }

    await Promise.allSettled(batch);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  log(`\nResults after ${requestsToSend} requests:`, colors.yellow);
  log(`  ✅ Successful: ${successCount}`, colors.green);
  log(`  🚫 Rate Limited (429): ${rateLimitedCount}`, colors.yellow);
  log(`  ❌ Errors: ${errorCount}`, colors.red);

  // Rate limiting should kick in
  if (rateLimitedCount > 0) {
    log('✅ Rate limiting is working (blocked some requests)', colors.green);
    return true;
  } else if (successCount === requestsToSend) {
    log('⚠️  WARNING: Rate limiting may not be active (all requests succeeded)', colors.yellow);
    return false;
  } else {
    log('❓ Inconclusive: Check rate limiter configuration', colors.yellow);
    return false;
  }
}

/**
 * Test 4: Input Validation (Injection Attempts)
 */
async function testInputValidation() {
  log('\n💉 Test 4: Input Validation & Injection Attempts', colors.blue);
  log('─'.repeat(70));

  const vulnerabilities = [];

  // SQL injection attempts (should fail gracefully)
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "<script>alert('XSS')</script>",
    "{{7*7}}",  // Template injection
    "../../../etc/passwd", // Path traversal
    "'; db.dropDatabase(); //", // NoSQL injection
  ];

  for (const input of maliciousInputs) {
    try {
      const response = await makeRequest('/api/leads/enrich', 'POST', {
        domain: input,
        orgId: 'test',
      });

      // Should get validation error, not 500
      if (response.status === 500) {
        vulnerabilities.push(`Malicious input "${input.substring(0, 20)}..." caused server error`);
      }
    } catch (error) {
      // Expected to fail, that's good
    }
  }

  if (vulnerabilities.length === 0) {
    log('✅ Input validation working (no injection vulnerabilities found)', colors.green);
  } else {
    log(`❌ Found ${vulnerabilities.length} potential injection vulnerabilities:`, colors.red);
    vulnerabilities.forEach(v => log(`   ${v}`, colors.red));
  }

  return vulnerabilities.length === 0;
}

/**
 * Main security audit execution
 */
async function runSecurityAudit() {
  console.log('\n');
  log('═'.repeat(70), colors.blue);
  log('  🛡️  SECURITY AUDIT - Production Readiness Check', colors.blue);
  log('═'.repeat(70), colors.blue);
  console.log();

  log(`Target: ${TEST_CONFIG.baseUrl}`, colors.yellow);
  console.log();

  const results = {
    apiKeyExposure: false,
    authBypass: false,
    rateLimiting: false,
    inputValidation: false,
  };

  try {
    // Run all security tests
    results.apiKeyExposure = await testAPIKeyExposure();
    results.authBypass = await testAuthBypass();
    results.rateLimiting = await testRateLimiting();
    results.inputValidation = await testInputValidation();

    // Final report
    console.log('\n');
    log('═'.repeat(70), colors.blue);
    log('  📊 SECURITY AUDIT RESULTS', colors.blue);
    log('═'.repeat(70), colors.blue);
    console.log();

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    log(`API Key Exposure: ${results.apiKeyExposure ? '✅ PASS' : '❌ FAIL'}`, results.apiKeyExposure ? colors.green : colors.red);
    log(`Auth Bypass Protection: ${results.authBypass ? '✅ PASS' : '❌ FAIL'}`, results.authBypass ? colors.green : colors.red);
    log(`Rate Limiting: ${results.rateLimiting ? '✅ PASS' : '❌ FAIL'}`, results.rateLimiting ? colors.green : colors.red);
    log(`Input Validation: ${results.inputValidation ? '✅ PASS' : '❌ FAIL'}`, results.inputValidation ? colors.green : colors.red);

    console.log();
    log(`Overall: ${passed}/${total} tests passed`, passed === total ? colors.green : colors.yellow);
    console.log();

    if (passed === total) {
      log('🎉 SECURITY AUDIT PASSED - Production ready!', colors.green);
    } else {
      log('⚠️  SECURITY ISSUES FOUND - Fix before production!', colors.red);
    }

    console.log();
    process.exit(passed === total ? 0 : 1);

  } catch (error) {
    log(`\n❌ Security audit failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSecurityAudit();
}

module.exports = { runSecurityAudit };

