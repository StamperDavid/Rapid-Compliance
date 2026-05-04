/**
 * Google Tokens — Central token store for the connected Google account.
 *
 * Per the architectural rule in
 * `feedback_one_google_account_per_tenant_runs_calendars_and_email`,
 * each tenant connects ONE Google account at onboarding via a single
 * OAuth consent flow that grants access to Gmail, Calendar, Drive,
 * YouTube, Google Business Profile, GA4, GSC, and Google Ads. All of
 * those services read their tokens from a single Firestore document so
 * the operator does not have to re-OAuth per service.
 *
 * Doc path: `organizations/{PLATFORM_ID}/connectedAccounts/google`
 *   - Single-tenant phase: PLATFORM_ID is the only tenant.
 *   - Multi-tenant flip: each tenant has their own subtree under
 *     `organizations/{tenantId}/connectedAccounts/google`.
 *
 * Tokens are stored encrypted (same `encryptToken` helper used by the
 * legacy `integrations/{id}` writes). Callers receive decrypted tokens
 * via `getConnectedGoogleTokens()`.
 *
 * Backward-compat: the legacy `integrations/{id}` writes are preserved
 * during migration so existing Gmail/Calendar/GSC consumers keep
 * working until each is migrated to read from this central store.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { encryptToken, decryptToken } from '@/lib/security/token-encryption';
import { logger } from '@/lib/logger/logger';

const FILE = 'integrations/google-tokens.ts';
const COLLECTION = 'connectedAccounts';
const DOC_ID = 'google';

/**
 * Decrypted, ready-to-use Google OAuth tokens for the connected account.
 * Returned by `getConnectedGoogleTokens()`. Callers pass `accessToken`
 * to googleapis.OAuth2Client.setCredentials().
 */
export interface ConnectedGoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Unix-epoch milliseconds; null if Google didn't return one. */
  expiryDate: number | null;
  /** Space-separated list of scopes the operator granted at consent. */
  scope: string;
  /** ISO timestamp when the OAuth flow completed. */
  connectedAt: string;
  /** ISO timestamp of the most recent token write (initial or refresh). */
  updatedAt: string;
  /**
   * The Google account email derived during OAuth (via /userinfo or
   * decoded id_token). Used as the FROM address for SendGrid sends and
   * the calendar identity for event writes. Empty string if not yet
   * resolved (older OAuth flows didn't capture it).
   */
  accountEmail: string;
}

/**
 * Stored shape (with encrypted tokens). Internal — callers should not
 * deal with encrypted strings, they get the decrypted shape via
 * `getConnectedGoogleTokens()`.
 */
interface StoredGoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  scope: string;
  connectedAt: string;
  updatedAt: string;
  accountEmail: string;
  encrypted: true;
}

export interface SaveConnectedGoogleTokensInput {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  scope?: string;
  accountEmail?: string;
}

/**
 * Persist the operator's Google OAuth tokens to the central store.
 * Called by the OAuth callback handler after a successful code-exchange.
 * Tokens are encrypted at rest.
 */
export async function saveConnectedGoogleTokens(
  input: SaveConnectedGoogleTokensInput,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firebase admin not initialized' };
  }
  if (!input.accessToken || input.accessToken.trim().length === 0) {
    return { success: false, error: 'accessToken is required' };
  }

  const now = new Date().toISOString();

  const doc: StoredGoogleTokens = {
    accessToken: encryptToken(input.accessToken),
    refreshToken: input.refreshToken
      ? encryptToken(input.refreshToken)
      : null,
    expiryDate: input.expiryDate ?? null,
    scope: input.scope ?? '',
    connectedAt: now,
    updatedAt: now,
    accountEmail: input.accountEmail ?? '',
    encrypted: true,
  };

  try {
    const path = getSubCollection(COLLECTION);
    // Preserve `connectedAt` if the doc already exists (so we don't reset
    // the original OAuth date on every token refresh).
    const ref = adminDb.collection(path).doc(DOC_ID);
    const existing = await ref.get();
    if (existing.exists) {
      const existingData = existing.data() as Partial<StoredGoogleTokens> | undefined;
      if (typeof existingData?.connectedAt === 'string' && existingData.connectedAt.length > 0) {
        doc.connectedAt = existingData.connectedAt;
      }
      // If the new save didn't capture an account email but a prior one
      // did, keep the prior value. (Token refreshes don't carry the
      // userinfo claim.)
      if (
        doc.accountEmail.length === 0 &&
        typeof existingData?.accountEmail === 'string' &&
        existingData.accountEmail.length > 0
      ) {
        doc.accountEmail = existingData.accountEmail;
      }
    }
    await ref.set(doc);
    logger.info('[google-tokens] saved connected Google account tokens', {
      file: FILE,
      hasRefreshToken: doc.refreshToken !== null,
      expiryDate: doc.expiryDate,
      scopeBytes: doc.scope.length,
      accountEmail: doc.accountEmail,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[google-tokens] save failed', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return { success: false, error: msg };
  }
}

/**
 * Read + decrypt the operator's connected Google tokens.
 * Returns null if no Google account is connected.
 */
export async function getConnectedGoogleTokens(): Promise<ConnectedGoogleTokens | null> {
  if (!adminDb) {
    logger.warn('[google-tokens] adminDb not available', { file: FILE });
    return null;
  }
  try {
    const path = getSubCollection(COLLECTION);
    const snap = await adminDb.collection(path).doc(DOC_ID).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data() as Partial<StoredGoogleTokens> | undefined;
    if (!data || typeof data.accessToken !== 'string') {
      return null;
    }

    const accessToken = decryptToken(data.accessToken);
    const refreshToken = data.refreshToken ? decryptToken(data.refreshToken) : null;

    return {
      accessToken,
      refreshToken,
      expiryDate: data.expiryDate ?? null,
      scope: data.scope ?? '',
      connectedAt: data.connectedAt ?? '',
      updatedAt: data.updatedAt ?? '',
      accountEmail: data.accountEmail ?? '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[google-tokens] read failed', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return null;
  }
}

/**
 * Convenience: get just the account email (used as FROM address).
 * Returns empty string if no account is connected — callers should
 * surface a "connect Google" CTA in that case rather than send.
 */
export async function getConnectedGoogleAccountEmail(): Promise<string> {
  const tokens = await getConnectedGoogleTokens();
  return tokens?.accountEmail ?? '';
}

/**
 * The full scope bundle requested when the operator connects Google
 * during onboarding. One consent screen covers every Google service
 * the platform integrates with so they don't have to re-OAuth per
 * feature later.
 *
 * Order matters for the consent UI — Google groups by service, so we
 * list scopes for one service contiguously. New scopes added here
 * automatically apply to future operator connections; existing
 * connections need to re-OAuth to grant the new scope.
 */
export const GOOGLE_FULL_SCOPE_BUNDLE: readonly string[] = [
  // Gmail — read replies, send via API as fallback if SendGrid path
  // is unavailable, modify (mark read after sync, archive).
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  // Calendar — read existing events for conflict detection, write new
  // events for every scheduled platform action (per Rule 2).
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  // Drive — file storage for generated content, brand assets, exports.
  'https://www.googleapis.com/auth/drive.file',
  // YouTube — channel management and video upload for VideoSpecialist.
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  // Google Business Profile — manage GBP listings the operator owns.
  'https://www.googleapis.com/auth/business.manage',
  // Google Analytics — read traffic data for /website/analytics.
  'https://www.googleapis.com/auth/analytics.readonly',
  // Search Console — read SEO data for /website/seo.
  'https://www.googleapis.com/auth/webmasters.readonly',
  // Google Ads — read campaign data; manage requires elevated developer
  // approval which we'll request post-MVP. Listing only the read scope
  // for now since /adwords scope encompasses both.
  'https://www.googleapis.com/auth/adwords',
  // Identity — needed to capture the operator's account email for use
  // as the FROM address on emails.
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Email-only scope bundle (used by the legacy GSC-only OAuth path
 * during migration). Will be removed once all Google integrations
 * read from the central store.
 */
export const GOOGLE_GSC_ONLY_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/webmasters.readonly',
];
