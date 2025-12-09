/**
 * Firebase Configuration
 * Centralized Firebase initialization for client and server
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase config (production values)
const firebaseConfig = {
  apiKey: 'AIzaSyAuoM61E76vsHrKIXvZuMdhJMwsxEFn1PA',
  authDomain: 'ai-sales-platform-4f5e4.firebaseapp.com',
  projectId: 'ai-sales-platform-4f5e4',
  storageBucket: 'ai-sales-platform-4f5e4.firebasestorage.app',
  messagingSenderId: '97257356518',
  appId: '1:97257356518:web:4e51eeb7e1a95e52018f27',
};

// Check if using emulator
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
let isFirebaseConfigured = true;

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

// Initialize Firebase on client-side
if (typeof window !== 'undefined' && (isFirebaseConfigured || useEmulator)) {
  initializeFirebase();
}

// Function to update config from admin settings (for future use)
export async function updateFirebaseConfigFromAdmin(): Promise<void> {
  // Reserved for admin config override
}

export { app, auth, db, storage, isFirebaseConfigured };
export default app;
