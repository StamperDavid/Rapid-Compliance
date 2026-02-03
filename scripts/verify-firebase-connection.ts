/**
 * Firebase Connection Verification Script
 * Tests the "Kill-Switch" connection to rapid-compliance-65f87
 *
 * Usage: npx ts-node scripts/verify-firebase-connection.ts
 */

import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
/**
 * Must match DEFAULT_ORG_ID in src/lib/constants/platform.ts
 * Duplicated here because scripts/ is outside the tsconfig project scope.
 */
const DEFAULT_ORG_ID = 'rapid-compliance-root';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function verifyConnection(): Promise<void> {
  console.log('🔥 Firebase Connection Verification');
  console.log('═'.repeat(50));
  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`Target Collection: organizations/${DEFAULT_ORG_ID}`);
  console.log('═'.repeat(50));

  // Clean up any existing app instances
  const existingApps = getApps();
  for (const app of existingApps) {
    await deleteApp(app);
  }

  // Initialize Firebase Admin
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!privateKey || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    console.error('❌ Missing Firebase Admin credentials in .env.local');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });

  const db = getFirestore(app);

  try {
    // Test 1: Write a document to organizations/salesvelocity
    console.log('\n📝 Test 1: Writing test document...');

    const testDoc = {
      _connectionTest: true,
      timestamp: Timestamp.now(),
      message: 'Kill-Switch connection verified',
      project: 'rapid-compliance-65f87',
      verifiedAt: new Date().toISOString(),
    };

    const docRef = db.collection('organizations').doc(DEFAULT_ORG_ID);
    await docRef.set(testDoc, { merge: true });
    console.log('✅ Write successful!');

    // Test 2: Read back the document
    console.log('\n📖 Test 2: Reading test document...');
    const snapshot = await docRef.get();

    if (snapshot.exists) {
      const data = snapshot.data();
      console.log('✅ Read successful!');
      console.log(`   - Connection Test Flag: ${data?._connectionTest}`);
      console.log(`   - Message: ${data?.message}`);
      console.log(`   - Verified At: ${data?.verifiedAt}`);
    } else {
      throw new Error('Document not found after write');
    }

    // Test 3: Clean up test fields (optional - keep the org doc)
    console.log('\n🧹 Test 3: Cleaning up test fields...');
    await docRef.update({
      _connectionTest: null,
      message: null,
      verifiedAt: null,
    });
    console.log('✅ Cleanup complete!');

    console.log('\n' + '═'.repeat(50));
    console.log('🎉 ALL TESTS PASSED - Firebase connection verified!');
    console.log('   Backend: rapid-compliance-65f87');
    console.log('   Status: CONNECTED');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await deleteApp(app);
  }
}

// Run verification
verifyConnection().catch(console.error);
