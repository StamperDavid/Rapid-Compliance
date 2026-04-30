/**
 * OAuth State Management
 * Generates and validates CSRF-safe OAuth state parameters.
 * Uses crypto.randomBytes + Firestore storage instead of predictable base64.
 *
 * Server-side ONLY — uses Admin SDK throughout. The client SDK has no
 * `request.auth` context inside server routes, so writing state via the
 * client SDK fails with PERMISSION_DENIED on every Connect-button click
 * (per `feedback_server_routes_must_use_admin_sdk`). Auth-gating happens
 * at the route layer (requireAuth), so the underlying Firestore write
 * does not need user-scoped rules — Admin SDK is correct here.
 */

import crypto from 'crypto';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const OAUTH_STATES_PATH = getSubCollection('oauthStates');
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StoredOAuthState {
  userId: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Generate a cryptographically secure OAuth state parameter and store it in Firestore.
 * Returns the state string to pass to the OAuth provider.
 */
export async function generateOAuthState(userId: string, provider: string): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');

  const stateData: StoredOAuthState = {
    userId,
    provider,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  };

  await AdminFirestoreService.set<StoredOAuthState>(OAUTH_STATES_PATH, state, stateData);

  return state;
}

/**
 * Validate an OAuth state parameter against Firestore.
 * Returns the userId if valid, null if invalid/expired.
 * Deletes the state document after validation to prevent reuse.
 */
export async function validateOAuthState(
  state: string,
  expectedProvider?: string
): Promise<string | null> {
  try {
    const stateData = await AdminFirestoreService.get<StoredOAuthState>(OAUTH_STATES_PATH, state);
    if (!stateData) {
      logger.warn('OAuth state not found in store', {
        file: 'oauth-state.ts',
        statePrefix: state.substring(0, 8),
      });
      return null;
    }

    // Check expiration
    if (new Date(stateData.expiresAt) < new Date()) {
      logger.warn('OAuth state expired', {
        file: 'oauth-state.ts',
        provider: stateData.provider,
      });
      await AdminFirestoreService.delete(OAUTH_STATES_PATH, state);
      return null;
    }

    // Check provider if specified
    if (expectedProvider && stateData.provider !== expectedProvider) {
      logger.warn('OAuth state provider mismatch', {
        file: 'oauth-state.ts',
        expected: expectedProvider,
        actual: stateData.provider,
      });
      await AdminFirestoreService.delete(OAUTH_STATES_PATH, state);
      return null;
    }

    // Delete state to prevent reuse (one-time token)
    await AdminFirestoreService.delete(OAUTH_STATES_PATH, state);

    return stateData.userId;
  } catch (error) {
    logger.error(
      'OAuth state validation error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'oauth-state.ts' }
    );
    return null;
  }
}
