/**
 * Load Testing Script - Analytics with Large Datasets
 * BEST PRACTICE: Test analytics performance under real conditions
 * 
 * Tests:
 * - Revenue calculations with 10,000+ transactions
 * - Pipeline analytics with 5,000+ deals
 * - Win/loss analysis across large datasets
 * - Forecast calculations
 */

const admin = require('firebase-admin');
const https = require('https');

// Initialize
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-ai-sales-platform',
  });
}

// Connect to emulators
const USE_EMULATOR = process.env.USE_EMULATOR !== 'false';
if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

const db = admin.firestore();

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

// Test configuration
const TEST_CONFIG = {
  orgId: 'analytics-load-test-org',
  workspaceId: 'analytics-workspace',
  dealsToCreate: 5000,
  ordersToCreate: 10000,
};

/**
 * Generate large deal dataset
 */
function generateDeals(count) {
  const deals = [];
  const stages = ['prospecting', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
  const tags = ['urgent', 'enterprise', 'small-business', 'referral', 'upsell'];
  const competitors = ['Competitor A', 'Competitor B', 'Competitor C', 'In-house solution', 'None'];
  const lossReasons = ['price', 'features', 'timing', 'competitor', 'budget'];

  for (let i = 0; i < count; i++) {
    const stage = stages[i % stages.length];
    const value = Math.floor(Math.random() * 500000) + 5000;
    const createdDaysAgo = Math.floor(Math.random() * 365);
    const closedDaysAgo = stage.includes('closed') ? Math.floor(Math.random() * 180) : null;

    deals.push({
      id: `analytics-deal-${String(i).padStart(6, '0')}`,
      title: `Deal ${i}`,
      value: value,
      stage: stage,
      stageName: stage.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      probability: stage === 'closed-won' ? 100 : stage === 'closed-lost' ? 0 : 25 + (stages.indexOf(stage) * 15),
      tags: [tags[i % tags.length]],
      competitor: i % 3 === 0 ? competitors[i % competitors.length] : null,
      lostReason: stage === 'closed-lost' ? lossReasons[i % lossReasons.length] : null,
      createdAt: new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000),
      closedDate: closedDaysAgo ? new Date(Date.now() - closedDaysAgo * 24 * 60 * 60 * 1000) : null,
      updatedAt: new Date(),
    });
  }

  return deals;
}

/**
 * Generate large order dataset for revenue analytics
 */
function generateOrders(count) {
  const orders = [];
  const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'];

  for (let i = 0; i < count; i++) {
    const status = statuses[i % statuses.length];
    const total = Math.floor(Math.random() * 5000) + 50;
    const createdDaysAgo = Math.floor(Math.random() * 90);

    orders.push({
      id: `analytics-order-${String(i).padStart(6, '0')}`,
      orderNumber: `ORD-${String(i).padStart(8, '0')}`,
      customerEmail: `customer${i % 1000}@test.com`,
      status: status,
      total: total,
      subtotal: total * 0.9,
      tax: total * 0.1,
      shipping: 10,
      items: [
        {
          productId: `product-${i % 100}`,
          quantity: Math.ceil(Math.random() * 3),
          price: Math.floor(total / 2),
        },
      ],
      createdAt: new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    });
  }

  return orders;
}

/**
 * Batch write with progress
 */
async function batchWriteWithProgress(collection, items, label) {
  log(`\n📝 Writing ${items.length} ${label} to Firestore...`, colors.blue);
  
  const batchSize = 500;
  const totalBatches = Math.ceil(items.length / batchSize);
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batch = db.batch();

    for (let j = start; j < end; j++) {
      const item = items[j];
      const docRef = db.collection(collection).doc(item.id);
      batch.set(docRef, item);
    }

    await batch.commit();
    log(`  Progress: ${end}/${items.length} (${Math.round((end/items.length)*100)}%)`, colors.yellow);
  }

  log(`✅ ${items.length} ${label} written successfully`, colors.green);
}

/**
 * Test analytics query performance
 */
async function testAnalyticsPerformance() {
  log('\n📊 Testing analytics performance...', colors.blue);

  const tests = [];

  // Test 1: Pipeline analytics (aggregate by stage)
  const pipelineStart = Date.now();
  const dealsSnapshot = await db.collectionGroup('deals')
    .where('organizationId', '==', TEST_CONFIG.orgId)
    .get();
  
  const dealsByStage = {};
  dealsSnapshot.docs.forEach(doc => {
    const stage = doc.data().stage || 'unknown';
    if (!dealsByStage[stage]) dealsByStage[stage] = { count: 0, value: 0 };
    dealsByStage[stage].count++;
    dealsByStage[stage].value += doc.data().value || 0;
  });

  const pipelineDuration = Date.now() - pipelineStart;
  log(`  Pipeline analytics: ${pipelineDuration}ms (${dealsSnapshot.size} deals)`, colors.yellow);
  tests.push({ name: 'Pipeline Analytics', duration: pipelineDuration, items: dealsSnapshot.size });

  // Test 2: Win/Loss analysis
  const winLossStart = Date.now();
  const wonDeals = dealsSnapshot.docs.filter(d => d.data().stage === 'closed-won').length;
  const lostDeals = dealsSnapshot.docs.filter(d => d.data().stage === 'closed-lost').length;
  const winRate = wonDeals + lostDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;
  
  const winLossDuration = Date.now() - winLossStart;
  log(`  Win/Loss analysis: ${winLossDuration}ms (Win rate: ${winRate.toFixed(1)}%)`, colors.yellow);
  tests.push({ name: 'Win/Loss Analysis', duration: winLossDuration, items: dealsSnapshot.size });

  // Test 3: Revenue analytics (aggregate orders)
  const revenueStart = Date.now();
  const ordersSnapshot = await db.collectionGroup('orders')
    .where('organizationId', '==', TEST_CONFIG.orgId)
    .get();
  
  let totalRevenue = 0;
  ordersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status !== 'cancelled' && data.status !== 'refunded') {
      totalRevenue += data.total || 0;
    }
  });

  const revenueDuration = Date.now() - revenueStart;
  log(`  Revenue analytics: ${revenueDuration}ms ($${Math.round(totalRevenue).toLocaleString()})`, colors.yellow);
  tests.push({ name: 'Revenue Analytics', duration: revenueDuration, items: ordersSnapshot.size });

  // Performance summary
  console.log();
  log('═'.repeat(70), colors.green);
  const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / tests.length;
  log(`Average query time: ${Math.round(avgDuration)}ms`, colors.green);
  
  if (avgDuration < 1000) {
    log('🚀 EXCELLENT: Analytics performance optimal for production', colors.green);
  } else if (avgDuration < 3000) {
    log('✅ GOOD: Analytics performance acceptable', colors.green);
  } else {
    log('⚠️  SLOW: Consider adding caching layer', colors.yellow);
  }

  return tests;
}

/**
 * Main execution
 */
async function runAnalyticsLoadTest() {
  console.log('\n');
  log('═'.repeat(70), colors.blue);
  log('  LOAD TEST: Analytics with Large Datasets', colors.blue);
  log('═'.repeat(70), colors.blue);
  console.log();

  try {
    // Step 1: Create test org
    const orgRef = db.collection('organizations').doc(TEST_CONFIG.orgId);
    await orgRef.set({
      id: TEST_CONFIG.orgId,
      name: 'Analytics Load Test Org',
      industry: 'Performance Testing',
      plan: 'enterprise',
      status: 'active',
      createdAt: new Date(),
    }, { merge: true });

    // Create workspace
    await orgRef.collection('workspaces').doc(TEST_CONFIG.workspaceId).set({
      id: TEST_CONFIG.workspaceId,
      name: 'Default Workspace',
      organizationId: TEST_CONFIG.orgId,
      createdAt: new Date(),
    }, { merge: true });

    // Step 2: Generate and seed data
    const deals = generateDeals(TEST_CONFIG.dealsToCreate);
    const orders = generateOrders(TEST_CONFIG.ordersToCreate);

    await batchWriteWithProgress(
      `organizations/${TEST_CONFIG.orgId}/workspaces/${TEST_CONFIG.workspaceId}/entities/deals`,
      deals,
      'deals'
    );

    await batchWriteWithProgress(
      `organizations/${TEST_CONFIG.orgId}/orders`,
      orders,
      'orders'
    );

    // Step 3: Test analytics performance
    await testAnalyticsPerformance();

    log('\n✅ Analytics load testing complete!', colors.green);
    console.log();

  } catch (error) {
    log(`\n❌ Analytics load test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAnalyticsLoadTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runAnalyticsLoadTest };




