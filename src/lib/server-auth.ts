/**
 * Server-Side Authentication Utilities
 * Get authenticated user from requests
 */

import { cookies } from 'next/headers';
import { auth } from '@/lib/firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Get the current authenticated user from the request
 * Returns null if no valid session
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return null;
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie.value, true);
    
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email || null,
      displayName: decodedClaims.name || decodedClaims.email || null,
    };
  } catch (error) {
    console.error('[Server Auth] Error verifying user:', error);
    return null;
  }
}

/**
 * Get user identifier for audit logs
 * Returns email or UID or 'system'
 */
export async function getUserIdentifier(): Promise<string> {
  const user = await getAuthenticatedUser();
  if (!user) return 'system';
  return user.displayName || user.email || user.uid;
}

