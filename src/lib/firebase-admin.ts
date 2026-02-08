/**
 * Centralized Firebase Admin SDK Initialization
 * Single source of truth for all Firebase Admin operations
 */

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  try {
    let credential;
    
    // Check for individual environment variables (Vercel format)
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
        process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }
    // In production, use service account from environment (JSON blob)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as admin.ServiceAccount;
      credential = admin.credential.cert(serviceAccount);
    }
    // In development, use service account file
    else {
      try {
        // Only require in development when file exists
        if (process.env.NODE_ENV === 'development') {
          const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');

          if (fs.existsSync(keyPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
            credential = admin.credential.cert(serviceAccount);
          } else {
            throw new Error('serviceAccountKey.json not found');
          }
        } else {
          // In production without env var, use application default
          credential = admin.credential.applicationDefault();
        }
      } catch {
        // Using application default credentials as fallback
        credential = admin.credential.applicationDefault();
      }
    }

    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    // Firebase Admin initialized successfully
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID !== '' && process.env.FIREBASE_ADMIN_PROJECT_ID != null
      ? process.env.FIREBASE_ADMIN_PROJECT_ID
      : 'NOT SET';
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Firebase Admin] Initialized successfully');
      // eslint-disable-next-line no-console
      console.log(`[Firebase Admin] 🎯 PROJECT ID: ${projectId}`);
    }
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw error;
  }
}

// Export commonly used services
export const db = getFirestore();
export const auth = getAuth();
export { admin };

/**
 * Helper to get current user from request
 */
export async function getCurrentUser(request: Request): Promise<{
  uid: string;
  email?: string;
} | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('[Auth] Failed to verify user:', error);
    return null;
  }
}

/**
 * Verify user has access to organization
 */
export async function verifyOrgAccess(
  userId: string
): Promise<boolean> {
  try {
    // Use environment-aware collection path via helper
    const { getOrgSubCollection } = await import('./firebase/collections');
    const membersPath = getOrgSubCollection('members');
    const userOrgRef = db.collection(membersPath).doc(userId);

    const doc = await userOrgRef.get();
    return doc.exists;
  } catch (error) {
    console.error('[Auth] Failed to verify org access:', error);
    return false;
  }
}

