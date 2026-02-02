/**
 * Firebase Configuration
 * Centralized Firebase initialization for client and server
 *
 * PENTHOUSE MODEL: Single-tenant deployment locked to rapid-compliance-65f87
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { logger } from '../logger/logger';

/**
 * Critical configuration error that halts Firebase initialization
 * Thrown when the Firebase project ID doesn't match the allowed project
 */
export class CriticalConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CriticalConfigurationError';
  }
}

/**
 * The ONLY allowed Firebase project ID for this deployment
 * Part of the Penthouse single-tenant security model
 */
const ALLOWED_PROJECT_ID = 'rapid-compliance-65f87';

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

/**
 * Validates that the Firebase project ID matches the allowed project
 * Only enforced in production runtime (not during builds)
 */
function validateProjectId(): void {
  // PENTHOUSE KILL-SWITCH: Only allow the designated Firebase project
  // Skip validation during Next.js build phase (BUILD_ID is set during build)
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  if (!isBuildPhase && firebaseConfig.projectId !== ALLOWED_PROJECT_ID) {
    throw new CriticalConfigurationError(
      `CRITICAL: Invalid Firebase project "${firebaseConfig.projectId}". ` +
      `This deployment ONLY allows "${ALLOWED_PROJECT_ID}". Halting all operations.`
    );
  }
}

function initializeFirebase() {
  if (!isFirebaseConfigured) {
    return;
  }

  // Validate project ID (skipped during build)
  validateProjectId();

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
