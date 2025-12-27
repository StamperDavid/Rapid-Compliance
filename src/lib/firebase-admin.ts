/**
 * Centralized Firebase Admin SDK Initialization
 * Single source of truth for all Firebase Admin operations
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  try {
    let credential;
    
    // In production, use service account from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = admin.credential.cert(serviceAccount);
    } 
    // In development, use service account file
    else {
      try {
        const serviceAccount = require('../../../serviceAccountKey.json');
        credential = admin.credential.cert(serviceAccount);
      } catch (error) {
        console.error('[Firebase Admin] Could not load serviceAccountKey.json, using application default credentials');
        credential = admin.credential.applicationDefault();
      }
    }

    admin.initializeApp({
      credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    console.log('[Firebase Admin] Initialized successfully');
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
 * TODO: Implement actual user authentication
 */
export async function getCurrentUser(request: Request): Promise<{
  uid: string;
  email?: string;
  organizationId?: string;
} | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // TODO: Fetch user's organizationId from Firestore
    // For now, return basic user info
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
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // TODO: Implement actual org access verification
    // Check if user is member of organization
    const userOrgRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('members')
      .doc(userId);

    const doc = await userOrgRef.get();
    return doc.exists;
  } catch (error) {
    console.error('[Auth] Failed to verify org access:', error);
    return false;
  }
}

