/**
 * E2E Test Setup
 * Connects to Firebase emulators and sets up real test data
 * BEST PRACTICE: Real integration testing, not mocks
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Test configuration
export const TEST_CONFIG = {
  projectId: 'demo-ai-sales-platform',
  emulators: {
    firestore: { host: 'localhost', port: 8080 },
    auth: { host: 'localhost', port: 9099 },
  },
  testOrg: {
    email: 'e2e-test@auraflow.test',
    password: 'Testing123!E2E',
    companyName: 'E2E Test Organization',
    userId: '', // Will be set after creation
    // Single-tenant: always use PLATFORM_ID
  },
};

// Initialize Firebase Admin for E2E tests
export function initializeFirebaseForTesting() {
  // Set emulator environment variables
  process.env.FIRESTORE_EMULATOR_HOST = `${TEST_CONFIG.emulators.firestore.host}:${TEST_CONFIG.emulators.firestore.port}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${TEST_CONFIG.emulators.auth.host}:${TEST_CONFIG.emulators.auth.port}`;

  if (getApps().length === 0) {
    initializeApp({
      projectId: TEST_CONFIG.projectId,
    });
  }

  return {
    db: getFirestore(),
    auth: getAuth(),
  };
}

// Test data IDs for consistent testing
export const TEST_IDS = {
  prospect: {
    id: 'test-prospect-001',
    email: 'test-prospect@example.com',
    phone: '+15555551234',
    firstName: 'Test',
    lastName: 'Prospect',
  },
  sequence: {
    id: 'test-sequence-001',
    name: 'E2E Test Sequence',
  },
  workflow: {
    id: 'test-workflow-001',
    name: 'E2E Test Workflow',
  },
};

/**
 * Setup test organization and basic data
 */
export async function setupTestOrganization() {
  const { db, auth } = initializeFirebaseForTesting();

  try {
    // Create test user
    const userRecord = await auth.createUser({
      email: TEST_CONFIG.testOrg.email,
      password: TEST_CONFIG.testOrg.password,
      displayName: TEST_CONFIG.testOrg.companyName,
    });

    TEST_CONFIG.testOrg.userId = userRecord.uid;
    console.log(`✅ Test user created: ${userRecord.uid}`);

    // Single-tenant: Use PLATFORM_ID for organization
    await db.collection('organizations').doc(PLATFORM_ID).set({
      id: PLATFORM_ID,
      name: TEST_CONFIG.testOrg.companyName,
      industry: 'Software Testing',
      plan: 'professional',
      status: 'active',
      createdAt: new Date(),
      createdBy: userRecord.uid,
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
      },
    }, { merge: true });

    console.log(`✅ Test organization configured: ${PLATFORM_ID}`);

    // Create user document
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: TEST_CONFIG.testOrg.email,
      name: 'E2E Test User',
      role: 'owner',
      createdAt: new Date(),
    });

    // Add to organization members
    await db.collection('organizations')
      .doc(PLATFORM_ID)
      .collection('members')
      .doc(userRecord.uid)
      .set({
        userId: userRecord.uid,
        email: TEST_CONFIG.testOrg.email,
        role: 'owner',
        addedAt: new Date(),
      });

    return {
      userId: userRecord.uid,
      db,
      auth,
    };
  } catch (error) {
    // If user already exists, just get their info
    if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(TEST_CONFIG.testOrg.email);

      return {
        userId: user.uid,
        db,
        auth,
      };
    }
    throw error;
  }
}

/**
 * Cleanup test organization after tests
 */
export async function cleanupTestOrganization() {
  const { db, auth } = initializeFirebaseForTesting();

  try {
    if (TEST_CONFIG.testOrg.userId) {
      // Delete user
      await auth.deleteUser(TEST_CONFIG.testOrg.userId);
      await db.collection('users').doc(TEST_CONFIG.testOrg.userId).delete();
    }

    // Single-tenant: Clean up test data from PLATFORM_ID organization
    const orgRef = db.collection('organizations').doc(PLATFORM_ID);

    // Delete test subcollections only (do not delete the entire organization)
    const subcollections = [
      'prospects',
      'sequences',
      'enrollments',
      'workflows',
      'smsMessages',
      'emails',
    ];

    for (const subcol of subcollections) {
      const snapshot = await orgRef.collection(subcol).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    console.log('✅ Test organization cleaned up');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('⚠️ Cleanup error:', errorMessage);
  }
}

/**
 * Create test prospect for sequence testing
 * @param _orgId - Unused, kept for backward compatibility. Always uses PLATFORM_ID.
 */
export async function createTestProspect(_orgId?: string) {
  const { db } = initializeFirebaseForTesting();
  const orgId = PLATFORM_ID;

  const prospectData = {
    id: TEST_IDS.prospect.id,
    email: TEST_IDS.prospect.email,
    phone: TEST_IDS.prospect.phone,
    firstName: TEST_IDS.prospect.firstName,
    lastName: TEST_IDS.prospect.lastName,
    company: 'Test Company Inc',
    title: 'CEO',
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('organizations')
    .doc(orgId)
    .collection('prospects')
    .doc(TEST_IDS.prospect.id)
    .set(prospectData);

  console.log('✅ Test prospect created');
  return prospectData;
}

/**
 * Create test sequence for testing
 * @param _orgId - Unused, kept for backward compatibility. Always uses PLATFORM_ID.
 */
export async function createTestSequence(_orgId?: string) {
  const { db } = initializeFirebaseForTesting();
  const orgId = PLATFORM_ID;

  const sequenceData = {
    id: TEST_IDS.sequence.id,
    name: TEST_IDS.sequence.name,
    status: 'active',
    steps: [
      {
        id: 'step-1',
        order: 0,
        type: 'email',
        delayDays: 0,
        delayHours: 0,
        subject: 'E2E Test Email - Step 1',
        content: 'Hello {{firstName}}, this is a test email from step 1.',
      },
      {
        id: 'step-2',
        order: 1,
        type: 'email',
        delayDays: 1,
        delayHours: 0,
        subject: 'E2E Test Email - Step 2',
        content: 'Follow-up email for {{firstName}} {{lastName}}.',
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
  };

  await db.collection('organizations')
    .doc(orgId)
    .collection('sequences')
    .doc(TEST_IDS.sequence.id)
    .set(sequenceData);

  console.log('✅ Test sequence created');
  return sequenceData;
}

/**
 * Create test workflow
 * @param _orgId - Unused, kept for backward compatibility. Always uses PLATFORM_ID.
 */
export async function createTestWorkflow(_orgId?: string) {
  const { db } = initializeFirebaseForTesting();
  const orgId = PLATFORM_ID;

  const workflowData = {
    id: TEST_IDS.workflow.id,
    name: TEST_IDS.workflow.name,
    trigger: {
      id: 'trigger-1',
      type: 'manual',
      config: {},
    },
    actions: [
      {
        id: 'action-1',
        type: 'send_email',
        name: 'Send Test Email',
        to: TEST_IDS.prospect.email,
        subject: 'E2E Test Workflow Email',
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
  };

  await db.collection('organizations')
    .doc(orgId)
    .collection('workflows')
    .doc(TEST_IDS.workflow.id)
    .set(workflowData);

  console.log('✅ Test workflow created');
  return workflowData;
}

