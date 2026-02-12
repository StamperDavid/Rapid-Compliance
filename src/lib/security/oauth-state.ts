/**
 * OAuth State Management
 * Generates and validates CSRF-safe OAuth state parameters.
 * Uses crypto.randomBytes + Firestore storage instead of predictable base64.
 */

import crypto from 'crypto';
import { FirestoreService } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const OAUTH_STATES_PATH = `organizations/${PLATFORM_ID}/oauthStates`;
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

  await FirestoreService.set(OAUTH_STATES_PATH, state, stateData, false);

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
    const raw = await FirestoreService.get(OAUTH_STATES_PATH, state);
    if (!raw) {
      logger.warn('OAuth state not found in store', {
        file: 'oauth-state.ts',
        statePrefix: state.substring(0, 8),
      });
      return null;
    }

    const stateData = raw as StoredOAuthState;

    // Check expiration
    if (new Date(stateData.expiresAt) < new Date()) {
      logger.warn('OAuth state expired', {
        file: 'oauth-state.ts',
        provider: stateData.provider,
      });
      await FirestoreService.delete(OAUTH_STATES_PATH, state);
      return null;
    }

    // Check provider if specified
    if (expectedProvider && stateData.provider !== expectedProvider) {
      logger.warn('OAuth state provider mismatch', {
        file: 'oauth-state.ts',
        expected: expectedProvider,
        actual: stateData.provider,
      });
      await FirestoreService.delete(OAUTH_STATES_PATH, state);
      return null;
    }

    // Delete state to prevent reuse (one-time token)
    await FirestoreService.delete(OAUTH_STATES_PATH, state);

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
