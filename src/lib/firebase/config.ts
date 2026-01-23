/**
 * Firebase Configuration
 * Centralized Firebase initialization for client and server
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { logger } from '../logger/logger';

// Firebase config from environment variables
// Loads from .env.local (local overrides) and .env.development/.env.production (defaults)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Check if Firebase is properly configured
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId
);

// Log configuration status (only in server-side)
if (typeof window === 'undefined') {
  logger.info('[Firebase Config] Checking configuration...', { file: 'config.ts' });
  logger.info('[Firebase Config] Configuration', { 
    projectId: firebaseConfig.projectId || 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING',
    isConfigured: isFirebaseConfigured,
    file: 'config.ts' 
  });
  
  if (!isFirebaseConfigured) {
    logger.error('[Firebase Config] ❌ Firebase is not properly configured!', new Error('[Firebase Config] ❌ Firebase is not properly configured!'), { file: 'config.ts' });
    logger.error('[Firebase Config] Missing environment variables. Check Vercel settings.', new Error('[Firebase Config] Missing environment variables. Check Vercel settings.'), { file: 'config.ts' });
  }
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function initializeFirebase() {
  if (!isFirebaseConfigured) {
    return;
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

// Initialize Firebase on client and server
if (isFirebaseConfigured) {
  initializeFirebase();
}

// Function to update config from admin settings (for future use)
export async function updateFirebaseConfigFromAdmin(): Promise<void> {
  // Reserved for admin config override
}

export { app, auth, db, storage, isFirebaseConfigured };
export default app;
