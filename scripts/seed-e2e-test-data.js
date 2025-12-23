/**
 * E2E Test Data Seeder
 * Creates minimal, focused test data for E2E testing
 * BEST PRACTICE: Idempotent script that can be run multiple times
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-ai-sales-platform',
  });
}

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const db = admin.firestore();
const auth = admin.auth();

const E2E_TEST_ACCOUNT = {
  email: 'e2e-auto-test@example.com',
  password: 'E2ETest123!Secure',
  companyName: 'E2E Automated Testing Org',
};

async function setupE2ETestData() {
  console.log('\n🧪 E2E TEST DATA SETUP');
  console.log('═'.repeat(70));
  
  try {
    // Step 1: Create/Get test user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: E2E_TEST_ACCOUNT.email,
        password: E2E_TEST_ACCOUNT.password,
        displayName: E2E_TEST_ACCOUNT.companyName,
      });
      console.log(`✅ Test user created: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        userRecord = await auth.getUserByEmail(E2E_TEST_ACCOUNT.email);
        console.log(`ℹ️  Test user already exists: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // Step 2: Create/Get organization
    const orgId = `e2e-test-org-${userRecord.uid}`;
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      await orgRef.set({
        id: orgId,
        name: E2E_TEST_ACCOUNT.companyName,
        industry: 'Software Testing',
        plan: 'professional',
        status: 'active',
        createdAt: new Date(),
        createdBy: userRecord.uid,
        settings: {
          timezone: 'America/New_York',
          currency: 'USD',
        },
      });
      console.log(`✅ Organization created: ${orgId}`);
    } else {
      console.log(`ℹ️  Organization already exists: ${orgId}`);
    }

    // Step 3: Create/Update user document
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: E2E_TEST_ACCOUNT.email,
      name: 'E2E Test User',
      role: 'owner',
      organizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    // Step 4: Add user to organization members
    await orgRef.collection('members').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: E2E_TEST_ACCOUNT.email,
      role: 'owner',
      addedAt: new Date(),
    }, { merge: true });

    // Step 5: Create test prospects (5 prospects for various tests)
    console.log('\n📝 Creating test prospects...');
    const prospects = [
      {
        id: 'e2e-prospect-001',
        email: 'prospect1@testcompany.com',
        phone: '+15555550001',
        firstName: 'Alice',
        lastName: 'Anderson',
        company: 'Anderson Enterprises',
        title: 'CEO',
        status: 'new',
      },
      {
        id: 'e2e-prospect-002',
        email: 'prospect2@testcompany.com',
        phone: '+15555550002',
        firstName: 'Bob',
        lastName: 'Builder',
        company: 'Builder Corp',
        title: 'CTO',
        status: 'qualified',
      },
      {
        id: 'e2e-prospect-003',
        email: 'prospect3@testcompany.com',
        phone: '+15555550003',
        firstName: 'Carol',
        lastName: 'Carter',
        company: 'Carter Solutions',
        title: 'VP Sales',
        status: 'new',
      },
    ];

    for (const prospect of prospects) {
      await orgRef.collection('prospects').doc(prospect.id).set({
        ...prospect,
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });
    }
    console.log(`✅ Created ${prospects.length} test prospects`);

    // Step 6: Create test sequence
    console.log('\n📧 Creating test sequence...');
    const sequenceId = 'e2e-test-sequence-001';
    await orgRef.collection('sequences').doc(sequenceId).set({
      id: sequenceId,
      name: 'E2E Test Sequence',
      description: 'Automated sequence for E2E testing',
      organizationId: orgId,
      status: 'active',
      steps: [
        {
          id: 'step-001',
          order: 0,
          type: 'email',
          delayDays: 0,
          delayHours: 0,
          subject: 'E2E Test Email - Initial Contact',
          content: 'Hello {{firstName}}, this is an automated test email.',
        },
        {
          id: 'step-002',
          order: 1,
          type: 'email',
          delayDays: 1,
          delayHours: 0,
          subject: 'E2E Test Email - Follow Up',
          content: 'Following up with {{firstName}} {{lastName}} from {{company}}.',
        },
      ],
      analytics: {
        totalEnrolled: 0,
        activeProspects: 0,
        completed: 0,
        bounced: 0,
        replied: 0,
        converted: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        meetingsBooked: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        conversionRate: 0,
        lastRun: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
    console.log(`✅ Test sequence created: ${sequenceId}`);

    // Step 7: Create test workflow
    console.log('\n⚙️  Creating test workflow...');
    const workflowId = 'e2e-test-workflow-001';
    await orgRef.collection('workflows').doc(workflowId).set({
      id: workflowId,
      organizationId: orgId,
      name: 'E2E Test Workflow',
      description: 'Automated workflow for E2E testing',
      trigger: {
        id: 'trigger-001',
        type: 'manual',
        config: {},
      },
      actions: [
        {
          id: 'action-001',
          type: 'send_email',
          name: 'Send Test Email',
          to: 'prospect1@testcompany.com',
          subject: 'E2E Workflow Test',
          body: 'This is a test email from the workflow.',
          bodyType: 'html',
        },
      ],
      conditions: [],
      settings: {
        onError: 'continue',
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
    console.log(`✅ Test workflow created: ${workflowId}`);

    // Summary
    console.log('\n═'.repeat(70));
    console.log('✅ E2E TEST DATA READY');
    console.log('═'.repeat(70));
    console.log(`Organization ID: ${orgId}`);
    console.log(`User ID: ${userRecord.uid}`);
    console.log(`Test Email: ${E2E_TEST_ACCOUNT.email}`);
    console.log(`Test Password: ${E2E_TEST_ACCOUNT.password}`);
    console.log('\nTest Data Created:');
    console.log(`  ✅ ${prospects.length} prospects`);
    console.log(`  ✅ 1 email sequence (2 steps)`);
    console.log(`  ✅ 1 workflow (email action)`);
    console.log('\n🧪 Ready to run E2E tests!\n');

    return { orgId, userId: userRecord.uid };
  } catch (error) {
    console.error('\n❌ E2E setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupE2ETestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { setupE2ETestData };

