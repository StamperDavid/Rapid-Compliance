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

  // For production - use service account
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Use application default credentials (for GCP)
      adminApp = admin.initializeApp();
    }

    console.log('🔥 Firebase Admin initialized');
    return adminApp;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      adminApp = admin.app();
      return adminApp;
    }
    throw error;
  }
}

// Initialize on import (server-side only)
if (typeof window === 'undefined') {
  try {
    initializeAdmin();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

// Export admin services
export const adminAuth = adminApp ? admin.auth(adminApp) : admin.auth();
export const adminDb = adminApp ? admin.firestore(adminApp) : admin.firestore();
export const adminStorage = adminApp ? admin.storage(adminApp) : admin.storage();

export { admin };
export default adminApp;

