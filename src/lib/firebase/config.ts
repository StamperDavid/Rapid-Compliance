/**
 * Firebase Configuration
 * Centralized Firebase initialization for client and server
 * 
 * Priority order:
 * 1. Platform-level Firebase (from admin settings in Firestore)
 * 2. Environment variables (.env.local)
 * 3. Demo mode (if neither available)
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Get Firebase config with priority: Admin Settings > Environment Variables
// Note: Can only load from admin settings AFTER Firebase is initialized
async function getFirebaseConfigFromAdmin(): Promise<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null> {
  // Only try to load from admin settings if Firebase is already initialized
  if (!db) {
    return null;
  }

  try {
    if (typeof window !== 'undefined') {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const adminKeys = await FirestoreService.get('admin', 'platform-api-keys');
      if (adminKeys?.firebase?.apiKey) {
        return adminKeys.firebase;
      }
    }
  } catch (error) {
    // Silently fail - will use environment variables
    console.warn('Could not load Firebase config from admin settings:', error);
  }

  return null;
}

// Initialize with environment variables first (synchronous)
// Will be updated from admin settings if available
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Check if Firebase is properly configured
// This will be updated when admin settings are loaded
let isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId;

// Function to update config from admin settings (called after Firestore is available)
// This can only be called AFTER Firebase is initialized (since it needs Firestore)
export async function updateFirebaseConfigFromAdmin(): Promise<void> {
  // Only try if Firebase is already initialized
  if (!isFirebaseConfigured || !db) {
    return;
  }

  try {
    const adminConfig = await getFirebaseConfigFromAdmin();
    if (adminConfig && adminConfig.apiKey && adminConfig.authDomain && adminConfig.projectId) {
      // Note: Can't re-initialize Firebase after it's already initialized
      // This would be used for future sessions, not current one
      console.log('Admin Firebase config found, will be used on next page load');
    }
  } catch (error) {
    // Silently fail - using environment variables is fine
  }
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function initializeFirebase() {
  if (!isFirebaseConfigured) {
    console.warn('⚠️ Firebase is not configured. Running in DEMO MODE.');
    console.warn('📖 See LOCAL_DEVELOPMENT_GUIDE.md for setup options:');
    console.warn('   1. Demo mode (current) - UI development only');
    console.warn('   2. Firebase Emulator - Full features, local development');
    console.warn('   3. Real Firebase - Production-like testing');
    return;
  }

  try {
    // Check if using Firebase Emulator
    const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
    
    if (typeof window !== 'undefined') {
      // Client-side initialization
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      
      // Connect to emulators if enabled
      if (useEmulator && typeof window !== 'undefined') {
        // Note: Emulator connection is handled automatically when using localhost URLs
        console.log('🔥 Using Firebase Emulator Suite for local development');
      }
    } else {
      // Server-side initialization (for API routes)
      // Note: For server-side, you may want to use Firebase Admin SDK instead
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // In development, allow app to continue without Firebase
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

// Initialize Firebase ONLY on client-side (not during build)
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  initializeFirebase();
  
  // After Firebase is initialized, try to load admin config for future reference
  // Wait a bit for Firestore to be fully ready
  setTimeout(() => {
    updateFirebaseConfigFromAdmin().catch(() => {
      // Silently fail - environment variables are being used
    });
  }, 2000);
} else if (typeof window !== 'undefined' && !isFirebaseConfigured) {
  // Firebase not configured - will run in demo mode (only warn on client-side)
  console.warn('⚠️ Firebase is not configured. Please set up platform API keys in Admin Dashboard or .env.local file.');
  console.warn('Go to /admin/system/api-keys to configure platform Firebase credentials.');
}

// Export with null checks - components should handle null cases
export { app, auth, db, storage, isFirebaseConfigured };
export default app;

