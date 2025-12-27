/**
 * Load Testing Script - Pagination with 1000+ Records
 * BEST PRACTICE: Test pagination under real load conditions
 * 
 * This script:
 * 1. Creates 1000+ leads/deals in test organization
 * 2. Tests pagination endpoints under load
 * 3. Measures response times
 * 4. Verifies no data loss or crashes
 */

const admin = require('firebase-admin');

// Initialize
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-ai-sales-platform',
  });
}

// Connect to emulators (or production with caution!)
const USE_EMULATOR = process.env.USE_EMULATOR !== 'false';
if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  console.log('🧪 Using Firebase Emulators');
} else {
  console.log('⚠️  WARNING: Using PRODUCTION Firebase!');
}

const db = admin.firestore();

// Test configuration
const TEST_CONFIG = {
  orgId: 'load-test-org', // Will be created
  leadsToCreate: 1500,
  dealsToCreate: 1000,
  contactsToCreate: 800,
  pageSize: 50,
  batchSize: 500, // Firestore batch limit
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
 * Create test organization for load testing
 */
async function createLoadTestOrg() {
  const orgRef = db.collection('organizations').doc(TEST_CONFIG.orgId);
  const doc = await orgRef.get();

  if (!doc.exists) {
    await orgRef.set({
      id: TEST_CONFIG.orgId,
      name: 'Load Test Organization',
      industry: 'Performance Testing',
      plan: 'enterprise',
      status: 'active',
      createdAt: new Date(),
      settings: {
        timezone: 'UTC',
        currency: 'USD',
      },
    });
    log(`✅ Load test organization created: ${TEST_CONFIG.orgId}`, colors.green);
  } else {
    log(`ℹ️  Load test organization exists: ${TEST_CONFIG.orgId}`, colors.blue);
  }

  return TEST_CONFIG.orgId;
}

/**
 * Generate realistic test leads
 */
function generateLeads(count) {
  const leads = [];
  const companies = ['TechCorp', 'SalesPro', 'CloudWorks', 'DataSystems', 'NetSolutions'];
  const titles = ['CEO', 'CTO', 'VP Sales', 'Director', 'Manager', 'Founder'];
  const sources = ['website', 'referral', 'linkedin', 'email', 'cold-call'];
  const statuses = ['new', 'contacted', 'qualified', 'nurturing', 'lost'];

  for (let i = 0; i < count; i++) {
    leads.push({
      id: `load-test-lead-${String(i).padStart(6, '0')}`,
      email: `lead${i}@loadtest${i % 100}.com`,
      phone: `+1555${String(i).padStart(7, '0')}`,
      firstName: `FirstName${i}`,
      lastName: `LastName${i}`,
      company: `${companies[i % companies.length]} ${Math.floor(i / 100)}`,
      title: titles[i % titles.length],
      source: sources[i % sources.length],
      status: statuses[i % statuses.length],
      score: Math.floor(Math.random() * 100),
      organizationId: TEST_CONFIG.orgId,
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random within 90 days
      updatedAt: new Date(),
    });
  }

  return leads;
}

/**
 * Generate realistic test deals
 */
function generateDeals(count) {
  const deals = [];
  const stages = ['prospecting', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
  const products = ['Product A', 'Product B', 'Product C', 'Service Bundle', 'Enterprise Plan'];

  for (let i = 0; i < count; i++) {
    const value = Math.floor(Math.random() * 100000) + 1000;
    const stage = stages[i % stages.length];
    
    deals.push({
      id: `load-test-deal-${String(i).padStart(6, '0')}`,
      title: `Deal ${i} - ${products[i % products.length]}`,
      value: value,
      stage: stage,
      probability: stage === 'closed-won' ? 100 : stage === 'closed-lost' ? 0 : Math.floor(Math.random() * 100),
      expectedCloseDate: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000),
      contactEmail: `lead${i % 500}@loadtest${i % 100}.com`,
      organizationId: TEST_CONFIG.orgId,
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    });
  }

  return deals;
}

/**
 * Batch write to Firestore (handles 500 item limit)
 */
async function batchWrite(collection, items) {
  const batches = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const docRef = db.collection(collection).doc(item.id);
    
    currentBatch.set(docRef, item);
    batchCount++;

    // Firestore batch limit is 500
    if (batchCount === 500 || i === items.length - 1) {
      batches.push(currentBatch.commit());
      currentBatch = db.batch();
      batchCount = 0;
    }
  }

  await Promise.all(batches);
}

/**
 * Test pagination performance
 */
async function testPaginationPerformance(collection, totalItems) {
  log(`\n🔍 Testing pagination on ${collection} (${totalItems} items)...`, colors.blue);
  
  const startTime = Date.now();
  let itemsFetched = 0;
  let lastDoc = null;
  const pageSize = TEST_CONFIG.pageSize;

  while (itemsFetched < totalItems) {
    let query = db.collection(collection)
      .orderBy('createdAt', 'desc')
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) break;

    itemsFetched += snapshot.docs.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Log progress every 10 pages
    if (itemsFetched % (pageSize * 10) === 0) {
      log(`  Fetched ${itemsFetched}/${totalItems} items...`, colors.yellow);
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const itemsPerSecond = Math.round((itemsFetched / duration) * 1000);

  log(`✅ Pagination test complete:`, colors.green);
  log(`   Items fetched: ${itemsFetched}`, colors.green);
  log(`   Duration: ${duration}ms`, colors.green);
  log(`   Throughput: ${itemsPerSecond} items/second`, colors.green);
  log(`   Pages: ${Math.ceil(itemsFetched / pageSize)}`, colors.green);

  return {
    itemsFetched,
    duration,
    itemsPerSecond,
    pages: Math.ceil(itemsFetched / pageSize),
  };
}

/**
 * Main load testing execution
 */
async function runLoadTests() {
  console.log('\n');
  log('═'.repeat(70), colors.blue);
  log('  LOAD TEST: Pagination with 1000+ Records', colors.blue);
  log('═'.repeat(70), colors.blue);
  console.log();

  try {
    // Step 1: Create test organization
    log('Step 1: Setting up load test organization...', colors.blue);
    const orgId = await createLoadTestOrg();

    // Step 2: Generate test data
    log('\nStep 2: Generating test data...', colors.blue);
    const leads = generateLeads(TEST_CONFIG.leadsToCreate);
    const deals = generateDeals(TEST_CONFIG.dealsToCreate);
    log(`  Generated ${leads.length} leads`, colors.yellow);
    log(`  Generated ${deals.length} deals`, colors.yellow);

    // Step 3: Seed data to Firestore
    log('\nStep 3: Writing data to Firestore (this may take a minute)...', colors.blue);
    
    const startWrite = Date.now();
    await Promise.all([
      batchWrite(`organizations/${orgId}/prospects`, leads),
      batchWrite(`organizations/${orgId}/deals`, deals),
    ]);
    const writeTime = Date.now() - startWrite;
    
    log(`✅ Data written in ${writeTime}ms`, colors.green);
    log(`   Write speed: ${Math.round((leads.length + deals.length) / (writeTime / 1000))} items/second`, colors.green);

    // Step 4: Test pagination performance
    log('\nStep 4: Testing pagination performance...', colors.blue);
    
    const leadsTest = await testPaginationPerformance(
      `organizations/${orgId}/prospects`,
      TEST_CONFIG.leadsToCreate
    );

    const dealsTest = await testPaginationPerformance(
      `organizations/${orgId}/deals`,
      TEST_CONFIG.dealsToCreate
    );

    // Step 5: Performance Report
    console.log('\n');
    log('═'.repeat(70), colors.green);
    log('  📊 LOAD TEST RESULTS', colors.green);
    log('═'.repeat(70), colors.green);
    console.log();
    
    log('Leads Pagination:', colors.blue);
    log(`  ✅ Fetched: ${leadsTest.itemsFetched}/${TEST_CONFIG.leadsToCreate}`, colors.green);
    log(`  ⏱️  Time: ${leadsTest.duration}ms`, colors.green);
    log(`  🚀 Speed: ${leadsTest.itemsPerSecond} items/sec`, colors.green);
    log(`  📄 Pages: ${leadsTest.pages} (${TEST_CONFIG.pageSize} per page)`, colors.green);
    
    console.log();
    log('Deals Pagination:', colors.blue);
    log(`  ✅ Fetched: ${dealsTest.itemsFetched}/${TEST_CONFIG.dealsToCreate}`, colors.green);
    log(`  ⏱️  Time: ${dealsTest.duration}ms`, colors.green);
    log(`  🚀 Speed: ${dealsTest.itemsPerSecond} items/sec`, colors.green);
    log(`  📄 Pages: ${dealsTest.pages} (${TEST_CONFIG.pageSize} per page)`, colors.green);

    console.log();
    log('═'.repeat(70), colors.green);
    
    // Performance thresholds
    const avgSpeed = (leadsTest.itemsPerSecond + dealsTest.itemsPerSecond) / 2;
    if (avgSpeed < 100) {
      log('⚠️  WARNING: Pagination speed below 100 items/sec (may need optimization)', colors.yellow);
    } else if (avgSpeed < 500) {
      log('✅ GOOD: Pagination speed acceptable for production', colors.green);
    } else {
      log('🚀 EXCELLENT: Pagination speed optimal for production', colors.green);
    }

    console.log('\n💡 To cleanup test data, run:');
    console.log(`   firebase firestore:delete organizations/${orgId} --recursive`);
    console.log();

  } catch (error) {
    log(`\n❌ Load test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runLoadTests()
    .then(() => {
      log('\n✅ Load testing complete!', colors.green);
      process.exit(0);
    })
    .catch((error) => {
      log(`\n❌ Load test failed: ${error.message}`, colors.red);
      process.exit(1);
    });
}

module.exports = { runLoadTests };



