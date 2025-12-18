/**
 * Firebase Configuration
 * Centralized Firebase initialization for client and server
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase config from environment variables
// Loads from .env.local (local overrides) and .env.development/.env.production (defaults)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Check if Firebase is properly configured
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId
);

// Log configuration status (only in server-side)
if (typeof window === 'undefined') {
  console.log('[Firebase Config] Checking configuration...');
  console.log('[Firebase Config] Project ID:', firebaseConfig.projectId || 'MISSING');
  console.log('[Firebase Config] Auth Domain:', firebaseConfig.authDomain || 'MISSING');
  console.log('[Firebase Config] Is Configured:', isFirebaseConfigured);
  
  if (!isFirebaseConfigured) {
    console.error('[Firebase Config] ❌ Firebase is not properly configured!');
    console.error('[Firebase Config] Missing environment variables. Check Vercel settings.');
  }
}

// Check if using emulator
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let emulatorsConnected = false;

function initializeFirebase() {
  if (!isFirebaseConfigured && !useEmulator) {
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
    
    // Connect to emulators if enabled (only once)
    if (useEmulator && !emulatorsConnected) {
      try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        connectStorageEmulator(storage, 'localhost', 9199);
        emulatorsConnected = true;
      } catch (error: any) {
        if (error.message?.includes('already been called')) {
          emulatorsConnected = true;
        }
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

// Initialize Firebase on client and server
if (isFirebaseConfigured || useEmulator) {
  initializeFirebase();
}

// Function to update config from admin settings (for future use)
export async function updateFirebaseConfigFromAdmin(): Promise<void> {
  // Reserved for admin config override
}

export { app, auth, db, storage, isFirebaseConfigured };
export default app;
