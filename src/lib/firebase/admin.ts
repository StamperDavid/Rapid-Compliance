/**
 * Firebase Admin SDK Configuration
 * Server-side only - for API routes and server actions
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
let adminApp: admin.app.App | null = null;

function initializeAdmin() {
  // Already initialized
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized by another module
  if (admin.apps.length > 0) {
    adminApp = admin.apps[0];
    return adminApp;
  }

  // For Firebase Emulator
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      adminApp = admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-ai-sales-platform',
      });

      // Set emulator host
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

      console.log('🔥 Firebase Admin initialized for emulator');
      return adminApp;
    } catch (error: any) {
      if (error.code === 'app/duplicate-app') {
        adminApp = admin.app();
        return adminApp;
      }
      throw error;
    }
  }

  // For production/development - use service account
  try {
    let serviceAccount: admin.ServiceAccount | undefined;
    
    // Option 1: Full JSON in single env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log('🔑 Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
    }
    
    // Option 2: Individual env vars (preferred for Vercel)
    if (!serviceAccount && process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      // Clean up private key: remove surrounding quotes and replace \n with actual newlines
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      
      // Remove surrounding quotes if present (common when copying from JSON)
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      };
      console.log('🔑 Using individual Firebase Admin env vars');
    }

    // Option 3: Try to load from file (local development)
    if (!serviceAccount) {
      try {
        const fs = require('fs');
        const path = require('path');
        const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
        console.log('🔍 Looking for serviceAccountKey.json at:', keyPath);
        if (fs.existsSync(keyPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          console.log('🔑 Loaded serviceAccountKey.json successfully');
        } else {
          console.warn('⚠️ serviceAccountKey.json not found at:', keyPath);
        }
      } catch (e: any) {
        console.warn('⚠️ Could not load serviceAccountKey.json:', e.message);
      }
    }

    if (serviceAccount) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Use application default credentials (for GCP)
      console.warn('⚠️ No Firebase credentials found, using default credentials');
      adminApp = admin.initializeApp();
    }

    console.log('🔥 Firebase Admin initialized');
    return adminApp;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      adminApp = admin.app();
      return adminApp;
    }
    console.error('❌ Firebase Admin initialization failed:', error.message);
    throw error;
  }
}

// Initialize on import (server-side only)
if (typeof window === 'undefined') {
  try {
    console.log('[Firebase Admin] Initializing...');
    console.log('[Firebase Admin] FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING');
    console.log('[Firebase Admin] FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING');
    console.log('[Firebase Admin] FIREBASE_ADMIN_PRIVATE_KEY:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? 'SET (length: ' + process.env.FIREBASE_ADMIN_PRIVATE_KEY.length + ')' : 'MISSING');
    initializeAdmin();
    console.log('[Firebase Admin] ✅ Initialization complete. adminApp:', adminApp ? 'INITIALIZED' : 'NULL');
  } catch (error: any) {
    console.error('[Firebase Admin] ❌ Initialization failed:', error.message);
    console.error('[Firebase Admin] Error stack:', error.stack);
  }
}

// Export admin services - only if properly initialized
export const adminAuth = adminApp ? admin.auth(adminApp) : null;
export const adminDb = adminApp ? admin.firestore(adminApp) : null;
export const adminStorage = adminApp ? admin.storage(adminApp) : null;

export { admin };
export default adminApp;






