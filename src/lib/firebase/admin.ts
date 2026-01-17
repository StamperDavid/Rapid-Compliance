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
    
    // Option 1: Full JSON in single env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      logger.info('🔑 Using FIREBASE_SERVICE_ACCOUNT_KEY env var', { file: 'admin.ts' });
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
      logger.info('🔑 Using individual Firebase Admin env vars', { file: 'admin.ts' });
    }

    // Option 3: Try to load from file (local development)
    if (!serviceAccount) {
      try {
        const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
        logger.info('🔍 Looking for serviceAccountKey.json', { path: keyPath, file: 'admin.ts' });
        if (fs.existsSync(keyPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          logger.info('🔑 Loaded serviceAccountKey.json successfully', { file: 'admin.ts' });
        } else {
          logger.warn('⚠️ serviceAccountKey.json not found', { path: keyPath, file: 'admin.ts' });
        }
      } catch (e: any) {
        logger.warn('⚠️ Could not load serviceAccountKey.json', { error: e.message, file: 'admin.ts' });
      }
    }

    // Get project ID from env as fallback
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      || process.env.FIREBASE_PROJECT_ID
      || process.env.FIREBASE_ADMIN_PROJECT_ID
      || 'ai-sales-platform-dev';

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

    console.log('[Auth] Firebase Admin Handshake Successful - Jasper is Online.');
    logger.info('🔥 Firebase Admin initialized', { file: 'admin.ts' });
    return adminApp;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      adminApp = admin.app();
      return adminApp;
    }
    logger.error('❌ Firebase Admin initialization failed', error, { file: 'admin.ts' });
    throw error;
  }
}

// Initialize on import (server-side only)
if (typeof window === 'undefined') {
  try {
    logger.info('[Firebase Admin] Initializing...', { 
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING',
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? `SET (length: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length})` : 'MISSING',
      file: 'admin.ts' 
    });
    initializeAdmin();
    logger.info('[Firebase Admin] ✅ Initialization complete', { 
      adminApp: adminApp ? 'INITIALIZED' : 'NULL',
      file: 'admin.ts' 
    });
  } catch (error) {
    logger.error('[Firebase Admin] ❌ Initialization failed', error, { file: 'admin.ts' });
  }
}

// Export admin services - only if properly initialized
export const adminAuth = adminApp ? admin.auth(adminApp) : null;
export const adminDb = adminApp ? admin.firestore(adminApp) : null;
export const adminStorage = adminApp ? admin.storage(adminApp) : null;

export { admin };
export default adminApp;






