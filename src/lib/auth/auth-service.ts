/**
 * Authentication Service
 * Handles all authentication operations using Firebase Auth
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  User,
  onAuthStateChanged,
  UserCredential,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';

// Check if Firebase is configured before using auth
// Only warn in non-build environments
if (!isFirebaseConfigured || !auth) {
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    console.warn('Firebase Auth is not configured. Authentication features will be disabled.');
  }
}
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/db/firestore-service';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * Sign up with email and password
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured. Please set up your .env.local file.');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile if display name provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    // Send email verification
    if (userCredential.user) {
      await sendEmailVerification(userCredential.user);
    }
    
    // Create user document in Firestore
    if (userCredential.user) {
      await FirestoreService.set(
        COLLECTIONS.USERS,
        userCredential.user.uid,
        {
          email: userCredential.user.email,
          displayName: displayName || userCredential.user.displayName,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        false
      );
    }
    
    return userCredential;
  } catch (error: any) {
    console.error('Error signing up:', error);
    throw new Error(error.message || 'Failed to sign up');
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured. Please set up your .env.local file.');
  }

  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.error('Error signing in:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    throw new Error(error.message || 'Failed to sign in with Google');
  }
}

/**
 * Sign in with Microsoft
 */
export async function signInWithMicrosoft(): Promise<UserCredential> {
  try {
    const provider = new OAuthProvider('microsoft.com');
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error('Error signing in with Microsoft:', error);
    throw new Error(error.message || 'Failed to sign in with Microsoft');
  }
}

/**
 * Sign out
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
}

/**
 * Send email verification
 */
export async function verifyEmail(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    await sendEmailVerification(user);
  } catch (error: any) {
    console.error('Error sending email verification:', error);
    throw new Error(error.message || 'Failed to send email verification');
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  if (!isFirebaseConfigured || !auth) {
    return null;
  }
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
): () => void {
  if (!isFirebaseConfigured || !auth) {
    // Return a no-op unsubscribe function
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Load user profile from Firestore
      const userProfile = await FirestoreService.get(COLLECTIONS.USERS, user.uid);
      
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || userProfile?.displayName || null,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: {
  displayName?: string;
  photoURL?: string;
}): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    
    await updateProfile(user, updates);
    
    // Also update Firestore
    await FirestoreService.update(COLLECTIONS.USERS, user.uid, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
}

