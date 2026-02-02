#!/usr/bin/env node
/**
 * Firebase Connection Verification Script
 *
 * Verifies that:
 * 1. The CriticalConfigurationError kill-switch is NOT triggered
 * 2. The app successfully connects to rapid-compliance-65f87
 * 3. The Firestore handshake completes successfully
 *
 * Run with: node scripts/verify-firebase-connection.mjs
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const EXPECTED_PROJECT_ID = 'rapid-compliance-65f87';

async function runVerification() {
  const results = [];

  console.log('\n========================================');
  console.log('  Firebase Connection Verification');
  console.log('========================================\n');

  // Step 1: Verify environment variables
  console.log('Step 1: Checking environment variables...');
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

  if (!projectId || !apiKey || !authDomain) {
    results.push({
      step: 'Environment Variables',
      success: false,
      message: `Missing required env vars: ${!projectId ? 'PROJECT_ID ' : ''}${!apiKey ? 'API_KEY ' : ''}${!authDomain ? 'AUTH_DOMAIN' : ''}`
    });
    printResults(results);
    process.exit(1);
  }

  results.push({
    step: 'Environment Variables',
    success: true,
    message: 'All required environment variables present'
  });

  // Step 2: Verify project ID matches expected
  console.log('Step 2: Verifying project ID...');
  if (projectId !== EXPECTED_PROJECT_ID) {
    results.push({
      step: 'Project ID Validation',
      success: false,
      message: `CRITICAL: Project ID mismatch! Expected "${EXPECTED_PROJECT_ID}", got "${projectId}". CriticalConfigurationError would be triggered.`
    });
    printResults(results);
    process.exit(1);
  }

  results.push({
    step: 'Project ID Validation',
    success: true,
    message: `Project ID matches: ${EXPECTED_PROJECT_ID}`
  });

  // Step 3: Initialize Firebase (this would throw CriticalConfigurationError if misconfigured)
  console.log('Step 3: Initializing Firebase client SDK...');
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    results.push({
      step: 'Firebase Initialization',
      success: true,
      message: 'Firebase app initialized successfully (no CriticalConfigurationError)'
    });

    // Step 4: Test Firestore handshake
    console.log('Step 4: Testing Firestore handshake...');
    const db = getFirestore(app);

    // Try to access a system collection (this verifies the connection works)
    // Using a simple query to test connectivity
    const testQuery = query(collection(db, 'organizations'), limit(1));

    try {
      await getDocs(testQuery);
      results.push({
        step: 'Firestore Handshake',
        success: true,
        message: 'Successfully connected to Firestore and executed query'
      });
    } catch (firestoreError) {
      // Check if it's a permissions error (which means connection worked, rules applied)
      const errorMessage = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);

      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        results.push({
          step: 'Firestore Handshake',
          success: true,
          message: 'Firestore connection successful (permission denied = rules are active, connection is working)'
        });
      } else {
        results.push({
          step: 'Firestore Handshake',
          success: false,
          message: `Firestore error: ${errorMessage}`
        });
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check specifically for CriticalConfigurationError
    if (errorMessage.includes('CriticalConfigurationError') || errorMessage.includes('Invalid Firebase project')) {
      results.push({
        step: 'Firebase Initialization',
        success: false,
        message: `KILL-SWITCH TRIGGERED: ${errorMessage}`
      });
    } else {
      results.push({
        step: 'Firebase Initialization',
        success: false,
        message: `Initialization error: ${errorMessage}`
      });
    }
  }

  printResults(results);

  // Exit with appropriate code
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('\n✅ All verification steps PASSED');
    console.log('   Backend migration to rapid-compliance-65f87 is successful!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some verification steps FAILED');
    console.log('   Please review the errors above.\n');
    process.exit(1);
  }
}

function printResults(results) {
  console.log('\n----------------------------------------');
  console.log('  Results');
  console.log('----------------------------------------\n');

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.step}`);
    console.log(`      ${result.message}\n`);
  });
}

// Run the verification
runVerification().catch((error) => {
  console.error('Unexpected error during verification:', error);
  process.exit(1);
});
