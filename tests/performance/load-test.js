/**
 * k6 Load Testing Script
 * Test platform performance under high load
 * 
 * Run with: k6 run load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 100 },   // 100 users over 2 minutes
    { duration: '5m', target: 100 },   // Stay at 100 for 5 minutes
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 500 },   // Ramp to 500
    { duration: '5m', target: 500 },   // Stay at 500
    { duration: '5m', target: 1000 },  // Spike to 1000
    { duration: '10m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
    errors: ['rate<0.05'],             // Custom error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test scenarios
export default function () {
  const scenarios = [
    testHomePage,
    testAgentChat,
    testCustomerList,
    testProductCatalog,
    testCheckout,
  ];
  
  // Random scenario selection
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();
  
  sleep(1);
}

/**
 * Test home page load
 */
function testHomePage() {
  const res = http.get(`${BASE_URL}/`);
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'page loads in < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
}

/**
 * Test agent chat endpoint
 */
function testAgentChat() {
  const payload = JSON.stringify({
    message: 'What is your return policy?',
    customerId: `test-customer-${__VU}`,
    agentId: 'test-agent',
    stream: false,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };
  
  const res = http.post(`${BASE_URL}/api/agent/chat`, payload, params);
  
  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(!success);
}

/**
 * Test customer list
 */
function testCustomerList() {
  const res = http.get(`${BASE_URL}/api/customers?page=1&limit=50`);
  
  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  errorRate.add(!success);
}

/**
 * Test product catalog
 */
function testProductCatalog() {
  const res = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  
  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  errorRate.add(!success);
}

/**
 * Test checkout flow
 */
function testCheckout() {
  const payload = JSON.stringify({
    items: [
      { productId: 'test-product-1', quantity: 1 },
      { productId: 'test-product-2', quantity: 2 },
    ],
    customer: {
      email: `test${__VU}@example.com`,
      firstName: 'Test',
      lastName: 'User',
    },
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const res = http.post(`${BASE_URL}/api/checkout/calculate`, payload, params);
  
  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
}

/**
 * Stress test - maximum load
 */
export function stressTest() {
  // Override options for stress testing
  options.stages = [
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '5m', target: 2000 },
    { duration: '5m', target: 0 },
  ];
}

/**
 * Spike test - sudden traffic spike
 */
export function spikeTest() {
  options.stages = [
    { duration: '10s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '10s', target: 1400 },  // Spike!
    { duration: '3m', target: 1400 },
    { duration: '10s', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '10s', target: 0 },
  ];
}



















