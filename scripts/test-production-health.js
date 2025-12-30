#!/usr/bin/env node

/**
 * Production Health Check
 * 
 * Tests all critical services and endpoints in production
 */

const https = require('https');
const http = require('http');

const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com';

const tests = [
  {
    name: 'Homepage Load',
    path: '/',
    expectedStatus: 200,
    critical: true,
  },
  {
    name: 'Health Check Endpoint',
    path: '/api/health',
    expectedStatus: 200,
    critical: true,
  },
  {
    name: 'API Auth Test',
    path: '/api/workspaces',
    expectedStatus: [401, 403], // Should require auth
    critical: true,
  },
  {
    name: 'Stripe Webhook Endpoint',
    path: '/api/webhooks/stripe',
    expectedStatus: 400, // POST required, but endpoint exists
    critical: true,
  },
];

function testEndpoint(test) {
  return new Promise((resolve) => {
    const url = new URL(test.path, PRODUCTION_URL);
    const client = url.protocol === 'https:' ? https : http;

    const startTime = Date.now();
    
    const req = client.get(url.toString(), (res) => {
      const responseTime = Date.now() - startTime;
      
      const expectedStatuses = Array.isArray(test.expectedStatus) 
        ? test.expectedStatus 
        : [test.expectedStatus];
      
      const passed = expectedStatuses.includes(res.statusCode);
      
      resolve({
        ...test,
        passed,
        actualStatus: res.statusCode,
        responseTime,
        error: null,
      });
    });

    req.on('error', (error) => {
      resolve({
        ...test,
        passed: false,
        actualStatus: null,
        responseTime: null,
        error: error.message,
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        ...test,
        passed: false,
        actualStatus: null,
        responseTime: null,
        error: 'Timeout (>10s)',
      });
    });
  });
}

async function runHealthChecks() {
  console.log('🏥 Production Health Check\n');
  console.log(`Testing: ${PRODUCTION_URL}\n`);
  console.log('='.repeat(70));

  const results = [];
  
  for (const test of tests) {
    process.stdout.write(`\n${test.name}... `);
    const result = await testEndpoint(test);
    results.push(result);
    
    if (result.passed) {
      console.log(`✅ ${result.actualStatus} (${result.responseTime}ms)`);
    } else {
      console.log(`❌ FAILED`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      } else {
        console.log(`   Expected: ${test.expectedStatus}, Got: ${result.actualStatus}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const criticalTests = results.filter(r => r.critical).length;
  const passedCritical = results.filter(r => r.critical && r.passed).length;
  
  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
  console.log(`   Critical: ${passedCritical}/${criticalTests} passed\n`);

  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.responseTime).length;
  
  if (!isNaN(avgResponseTime)) {
    console.log(`⚡ Average Response Time: ${Math.round(avgResponseTime)}ms\n`);
  }

  if (passedCritical === criticalTests) {
    console.log('✅ All critical services are healthy!\n');
    process.exit(0);
  } else {
    console.log('❌ Some critical services are failing!\n');
    process.exit(1);
  }
}

// Validate PRODUCTION_URL
if (!PRODUCTION_URL || PRODUCTION_URL.includes('localhost') || PRODUCTION_URL.includes('yourdomain')) {
  console.error('❌ Invalid NEXT_PUBLIC_APP_URL');
  console.error(`   Current: ${PRODUCTION_URL}`);
  console.error('\nSet the correct production URL in environment variables\n');
  process.exit(1);
}

runHealthChecks().catch(error => {
  console.error('\n❌ Health check failed:', error);
  process.exit(1);
});
