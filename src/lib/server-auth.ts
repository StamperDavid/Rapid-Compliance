/**
 * Server-Side Authentication Utilities
 * Get authenticated user from requests
 */

import { cookies } from 'next/headers';
import { auth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';

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
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return null;
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie.value, true);

    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email ?? null,
      displayName: (decodedClaims.name as string | undefined) ?? decodedClaims.email ?? null,
    };
  } catch (error) {
    logger.error('[Server Auth] Error verifying user', error instanceof Error ? error : new Error(String(error)), { file: 'server-auth.ts' });
    return null;
  }
}

/**
 * Get user identifier for audit logs
 * Returns email or UID or 'system'
 */
export async function getUserIdentifier(): Promise<string> {
  const user = await getAuthenticatedUser();
  if (!user) {return 'system';}
return user.displayName ?? user.email ?? user.uid;
}


