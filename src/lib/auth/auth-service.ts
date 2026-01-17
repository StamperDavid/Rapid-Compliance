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
  onAuthStateChanged,
  type User,
  type UserCredential
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { dal } from '@/lib/firebase/dal';
import { serverTimestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

// Check if Firebase is configured before using auth
// Only warn in non-build environments
if (!isFirebaseConfigured || !auth) {
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    logger.warn('Firebase Auth is not configured. Authentication features will be disabled.', { file: 'auth-service.ts' });
  }
}

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

    // Create user document in Firestore using DAL
    if (userCredential.user) {
      await dal.safeSetDoc('USERS', userCredential.user.uid, {
        email: userCredential.user.email,
        displayName:displayName ?? userCredential.user.displayName,
        emailVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, {
        audit: true,
        userId: userCredential.user.uid,
      });
    }

    return userCredential;
  } catch (error) {
    logger.error('Error signing up:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to sign up';
    throw new Error(errorMessage);
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
  } catch (error) {
    logger.error('Error signing in:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to sign in';
    throw new Error(errorMessage);
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider);
  } catch (error) {
    logger.error('Error signing in with Google:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to sign in with Google';
    throw new Error(errorMessage);
  }
}

/**
 * Sign in with Microsoft
 */
export async function signInWithMicrosoft(): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    const provider = new OAuthProvider('microsoft.com');
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider);
  } catch (error) {
    logger.error('Error signing in with Microsoft:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to sign in with Microsoft';
    throw new Error(errorMessage);
  }
}

/**
 * Sign out
 */
export async function signOutUser(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    await signOut(auth);
  } catch (error) {
    logger.error('Error signing out:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to sign out';
    throw new Error(errorMessage);
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    logger.error('Error sending password reset:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to send password reset email';
    throw new Error(errorMessage);
  }
}

/**
 * Send email verification
 */
export async function verifyEmail(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    await sendEmailVerification(user);
  } catch (error) {
    logger.error('Error sending email verification:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to send email verification';
    throw new Error(errorMessage);
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

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      // Load user profile from Firestore using DAL
      void dal.safeGetDoc('USERS', user.uid).then((userDoc) => {
        const userProfile = userDoc.exists() ? userDoc.data() : null;
        const displayNameFromProfile = userProfile && typeof userProfile === 'object' && 'displayName' in userProfile
          ? String(userProfile.displayName)
          : null;

        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? displayNameFromProfile ?? null,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
        });
      }).catch((error: unknown) => {
        logger.error('Error loading user profile in auth state change:', error, { file: 'auth-service.ts' });
        // Still callback with basic user info even if profile load fails
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
        });
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
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    await updateProfile(user, updates);

    // Also update Firestore using DAL
    await dal.safeUpdateDoc('USERS', user.uid, {
      ...updates,
      updatedAt: serverTimestamp(),
    }, {
      audit: true,
      userId: user.uid,
    });
  } catch (error) {
    logger.error('Error updating profile:', error, { file: 'auth-service.ts' });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to update profile';
    throw new Error(errorMessage);
  }
}
