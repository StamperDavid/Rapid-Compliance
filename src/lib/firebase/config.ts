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
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

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
    // Don't log if it's an offline error (emulators not running)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'unavailable') {
      // Emulators not running - this is expected in some dev setups
      return null;
    }
    console.debug('Could not load Firebase config from admin settings (using env vars instead)');
  }

  return null;
}

// Initialize with environment variables first (synchronous)
// Will be updated from admin settings if available
// Use demo config for emulator if no real config provided
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abc123',
};

// Check if using emulator (must be at module level)
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// ALWAYS initialize when emulator is enabled
let isFirebaseConfigured = true; // Force enable for emulator

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

// Track if emulators are already connected
let emulatorsConnected = false;

function initializeFirebase() {
  console.log('🔍 Firebase init - useEmulator:', useEmulator, 'isConfigured:', isFirebaseConfigured);
  
  // Skip initialization if not configured and not using emulator
  if (!isFirebaseConfigured && !useEmulator) {
    console.warn('⚠️ Firebase is not configured. Running in DEMO MODE.');
    console.warn('📖 See LOCAL_DEVELOPMENT_GUIDE.md for setup options:');
    console.warn('   1. Demo mode (current) - UI development only');
    console.warn('   2. Firebase Emulator - Full features, local development');
    console.warn('   3. Real Firebase - Production-like testing');
    return;
  }

  try {
    
    if (typeof window !== 'undefined') {
      console.log('🔍 Client-side initialization starting...');
      // Client-side initialization
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
          // Connect to Firestore emulator
          connectFirestoreEmulator(db, 'localhost', 8080);
          
          // Connect to Auth emulator
          connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
          
          // Connect to Storage emulator
          connectStorageEmulator(storage, 'localhost', 9199);
          
          emulatorsConnected = true;
          
          console.log('🔥 Connected to Firebase Emulator Suite');
          console.log('   Firestore: localhost:8080');
          console.log('   Auth: localhost:9099');
          console.log('   Storage: localhost:9199');
          console.log('   UI: http://localhost:4000');
          console.log('   💡 Tip: Run "firebase emulators:start" in a separate terminal if not already running');
        } catch (error: any) {
          // Already connected to emulator (this is fine)
          if (error.message?.includes('already been called')) {
            console.log('🔥 Firebase Emulators already connected');
            emulatorsConnected = true;
          } else {
            console.warn('⚠️ Could not connect to Firebase Emulators');
            console.warn('   Make sure emulators are running: firebase emulators:start');
            console.warn('   Or set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false in .env.local');
            // Don't mark as connected if connection failed
            emulatorsConnected = false;
          }
        }
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
      
      // Connect to emulators on server-side too (only once)
      if (useEmulator && !emulatorsConnected) {
        try {
          connectFirestoreEmulator(db, 'localhost', 8080);
          connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
          connectStorageEmulator(storage, 'localhost', 9199);
          emulatorsConnected = true;
        } catch (error: any) {
          // Already connected (this is fine)
          if (error.message?.includes('already been called')) {
            emulatorsConnected = true;
          } else {
            console.warn('Server: Could not connect to Firebase Emulators');
            emulatorsConnected = false;
          }
        }
      }
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
if (typeof window !== 'undefined' && (isFirebaseConfigured || useEmulator)) {
  initializeFirebase();
  
  // After Firebase is initialized, try to load admin config for future reference
  // Only do this if we're connected to emulators and they're actually running
  if (useEmulator && emulatorsConnected) {
    setTimeout(() => {
      updateFirebaseConfigFromAdmin().catch(() => {
        // Silently fail - environment variables are being used
      });
    }, 3000); // Wait 3 seconds for emulators to be fully ready
  }
} else if (typeof window !== 'undefined' && !isFirebaseConfigured && !useEmulator) {
  // Firebase not configured - will run in demo mode (only warn on client-side)
  console.warn('⚠️ Firebase is not configured. Please set up platform API keys in Admin Dashboard or .env.local file.');
  console.warn('Go to /admin/system/api-keys to configure platform Firebase credentials.');
}

// Export with null checks - components should handle null cases
export { app, auth, db, storage, isFirebaseConfigured };
export default app;

