/**
 * Firebase Admin SDK Configuration
 * Server-side only - for API routes and server actions
 */

import * as admin from 'firebase-admin'
import fs from 'fs';
import path from 'path';
import { logger } from '../logger/logger';

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

  // Emulator support removed - tests use real dev database with cleanup

  // For production/development - use service account
  try {
    let serviceAccount: admin.ServiceAccount | undefined;

    // Production: Service account from env var (supports base64 or raw JSON)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (raw.startsWith('{')) {
        // Raw JSON — works locally or when env var escaping is intact
        serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
        logger.info('Using raw JSON FIREBASE_SERVICE_ACCOUNT_KEY', { file: 'admin.ts' });
      } else {
        // Base64-encoded JSON — recommended for Vercel to avoid newline mangling
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
        logger.info('Using base64 FIREBASE_SERVICE_ACCOUNT_KEY', { file: 'admin.ts' });
      }
    }

    // Local development: Load from serviceAccountKey.json file
    if (!serviceAccount) {
      try {
        const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
        logger.info('🔍 Looking for serviceAccountKey.json', { path: keyPath, file: 'admin.ts' });
        if (fs.existsSync(keyPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
          logger.info('🔑 Loaded serviceAccountKey.json successfully', { file: 'admin.ts' });
        } else {
          logger.warn('⚠️ serviceAccountKey.json not found', { path: keyPath, file: 'admin.ts' });
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.warn('⚠️ Could not load serviceAccountKey.json', { error: errorMessage, file: 'admin.ts' });
      }
    }

    // Get project ID from env as fallback
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ?? process.env.FIREBASE_PROJECT_ID
      ?? process.env.FIREBASE_ADMIN_PROJECT_ID
      ?? 'ai-sales-platform-dev';

    if (serviceAccount) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else {
      // Initialize with just project ID (no service account credentials)
      logger.warn('⚠️ No Firebase credentials found, using project ID only:', { projectId, file: 'admin.ts' });
      adminApp = admin.initializeApp({
        projectId,
      });
    }

    // eslint-disable-next-line no-console -- Required for startup handshake confirmation
    console.log('[Auth] Firebase Admin Handshake Successful - Jasper is Online.');
    logger.info('🔥 Firebase Admin initialized', { file: 'admin.ts' });
    return adminApp;
  } catch (error: unknown) {
    interface FirebaseError {
      code?: string;
      message?: string;
    }
    const firebaseError = error as FirebaseError;
    if (firebaseError.code === 'app/duplicate-app') {
      adminApp = admin.app();
      return adminApp;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('❌ Firebase Admin initialization failed', err, { file: 'admin.ts' });
    throw err;
  }
}

// Initialize on import (server-side only)
if (typeof window === 'undefined') {
  try {
    logger.info('[Firebase Admin] Initializing...', {
      serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'MISSING',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'SET' : 'MISSING',
      file: 'admin.ts'
    });
    initializeAdmin();
    logger.info('[Firebase Admin] ✅ Initialization complete', { 
      adminApp: adminApp ? 'INITIALIZED' : 'NULL',
      file: 'admin.ts' 
    });
  } catch (error) {
    logger.error('[Firebase Admin] ❌ Initialization failed', error instanceof Error ? error : new Error(String(error)), { file: 'admin.ts' });
  }
}

// Export admin services - only if properly initialized
export const adminAuth = adminApp ? admin.auth(adminApp) : null;
export const adminDb = adminApp ? admin.firestore(adminApp) : null;
export const adminStorage = adminApp ? admin.storage(adminApp) : null;

export { admin };
export default adminApp;






