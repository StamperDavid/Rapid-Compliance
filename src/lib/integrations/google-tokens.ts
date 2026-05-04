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
  /**
   * Selected Google Business Profile account name (e.g., "accounts/12345").
   * Picked by the operator after central OAuth via the GBP location
   * picker UI. Optional — undefined until the operator has selected a
   * location. Stored on the same connected-Google doc so the GBP service
   * factory can read tokens + selection in one round-trip.
   */
  gbpAccountId?: string;
  /**
   * Selected Google Business Profile location name (e.g., "locations/67890").
   * Pairs with `gbpAccountId`. Optional — undefined until the operator
   * has selected a location.
   */
  gbpLocationId?: string;
  /**
   * Display name of the selected GBP location (e.g., "SalesVelocity HQ").
   * Used only for UI/logging — the API uses gbpAccountId/gbpLocationId
   * to resolve the location path. Optional.
   */
  gbpLocationName?: string;
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
  /** GBP location selection — see ConnectedGoogleTokens for semantics. */
  gbpAccountId?: string;
  gbpLocationId?: string;
  gbpLocationName?: string;
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
      // Preserve the operator's GBP location selection across token
      // refreshes. The refresh path calls back into this save with only
      // token fields, so without this carry-forward the selection would
      // be wiped out and the operator would have to re-pick after every
      // refresh.
      if (typeof existingData?.gbpAccountId === 'string' && existingData.gbpAccountId.length > 0) {
        doc.gbpAccountId = existingData.gbpAccountId;
      }
      if (typeof existingData?.gbpLocationId === 'string' && existingData.gbpLocationId.length > 0) {
        doc.gbpLocationId = existingData.gbpLocationId;
      }
      if (typeof existingData?.gbpLocationName === 'string' && existingData.gbpLocationName.length > 0) {
        doc.gbpLocationName = existingData.gbpLocationName;
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
      gbpAccountId: data.gbpAccountId,
      gbpLocationId: data.gbpLocationId,
      gbpLocationName: data.gbpLocationName,
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
 * The operator's chosen Google Business Profile location. Stored on the
 * same connected-Google doc as the OAuth tokens so the GBP service
 * factory can read tokens + selection in one round-trip.
 */
export interface ConnectedGoogleGbpSelection {
  gbpAccountId?: string;
  gbpLocationId?: string;
  gbpLocationName?: string;
}

/**
 * Read the operator's GBP location selection from the central
 * connected-Google doc. Returns an object with all three fields
 * undefined if no selection has been made yet (or no Google account is
 * connected).
 *
 * Callers that need the OAuth tokens AND the selection in the same
 * read should call `getConnectedGoogleTokens()` once and pluck the
 * `gbpAccountId` / `gbpLocationId` / `gbpLocationName` fields directly
 * — that's a single Firestore read instead of two.
 */
export async function getConnectedGoogleGbpSelection(): Promise<ConnectedGoogleGbpSelection> {
  if (!adminDb) {
    return {};
  }
  try {
    const path = getSubCollection(COLLECTION);
    const snap = await adminDb.collection(path).doc(DOC_ID).get();
    if (!snap.exists) {
      return {};
    }
    const data = snap.data() as Partial<StoredGoogleTokens> | undefined;
    if (!data) {
      return {};
    }
    return {
      gbpAccountId: data.gbpAccountId,
      gbpLocationId: data.gbpLocationId,
      gbpLocationName: data.gbpLocationName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[google-tokens] gbp selection read failed',
      err instanceof Error ? err : new Error(msg),
      { file: FILE },
    );
    return {};
  }
}

export interface SetConnectedGoogleGbpSelectionInput {
  gbpAccountId: string;
  gbpLocationId: string;
  gbpLocationName?: string;
}

/**
 * Persist the operator's chosen GBP location to the connected-Google
 * doc. Merge-set — touches ONLY the three GBP selection fields,
 * leaves the encrypted access/refresh tokens and other metadata intact.
 *
 * Returns `{ success: false }` if no Google account is connected yet
 * (the doc doesn't exist) — the operator must complete OAuth first.
 */
export async function setConnectedGoogleGbpSelection(
  input: SetConnectedGoogleGbpSelectionInput,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firebase admin not initialized' };
  }
  if (!input.gbpAccountId || input.gbpAccountId.trim().length === 0) {
    return { success: false, error: 'gbpAccountId is required' };
  }
  if (!input.gbpLocationId || input.gbpLocationId.trim().length === 0) {
    return { success: false, error: 'gbpLocationId is required' };
  }

  try {
    const path = getSubCollection(COLLECTION);
    const ref = adminDb.collection(path).doc(DOC_ID);
    const existing = await ref.get();
    if (!existing.exists) {
      return {
        success: false,
        error: 'No connected Google account — connect Google before selecting a GBP location',
      };
    }

    const update: Partial<StoredGoogleTokens> = {
      gbpAccountId: input.gbpAccountId,
      gbpLocationId: input.gbpLocationId,
      updatedAt: new Date().toISOString(),
    };
    if (typeof input.gbpLocationName === 'string' && input.gbpLocationName.length > 0) {
      update.gbpLocationName = input.gbpLocationName;
    }

    await ref.set(update, { merge: true });
    logger.info('[google-tokens] GBP selection saved', {
      file: FILE,
      gbpAccountId: input.gbpAccountId,
      gbpLocationId: input.gbpLocationId,
      gbpLocationName: input.gbpLocationName ?? '',
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[google-tokens] GBP selection save failed',
      err instanceof Error ? err : new Error(msg),
      { file: FILE },
    );
    return { success: false, error: msg };
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

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Refresh the connected Google access token using the stored refresh
 * token, then persist the new access token (and any new refresh token
 * Google rotates in) back to the central store.
 *
 * Returns the freshly-refreshed tokens on success, or null if:
 *   - No Google account is connected
 *   - The stored refresh token is missing
 *   - GOOGLE_CLIENT_ID/SECRET env vars are missing
 *   - Google's token endpoint rejects the refresh
 *
 * Callers (e.g., per-service integrations like YouTube) should treat
 * a null return as "operator must reconnect Google" — a refresh
 * failure typically means the operator revoked access or the refresh
 * token was rotated by Google's 6-month inactivity policy.
 */
export async function refreshConnectedGoogleTokens(): Promise<ConnectedGoogleTokens | null> {
  const existing = await getConnectedGoogleTokens();
  if (!existing) {
    logger.warn('[google-tokens] refresh requested but no connected Google account', { file: FILE });
    return null;
  }
  if (!existing.refreshToken) {
    logger.warn('[google-tokens] refresh requested but no refresh token stored', { file: FILE });
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error(
      '[google-tokens] cannot refresh — GOOGLE_CLIENT_ID/SECRET not set',
      new Error('missing google oauth env'),
      { file: FILE },
    );
    return null;
  }

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: existing.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      const errMsg = data.error_description ?? data.error ?? `status ${res.status}`;
      logger.error(
        '[google-tokens] refresh failed at Google token endpoint',
        new Error(errMsg),
        { file: FILE },
      );
      return null;
    }

    const newExpiryDate = typeof data.expires_in === 'number'
      ? Date.now() + data.expires_in * 1000
      : null;

    const saved = await saveConnectedGoogleTokens({
      accessToken: data.access_token,
      // Google sometimes rotates refresh tokens; keep the existing one
      // if no new value is returned in the response.
      refreshToken: data.refresh_token ?? existing.refreshToken,
      expiryDate: newExpiryDate,
      scope: data.scope ?? existing.scope,
      accountEmail: existing.accountEmail,
    });

    if (!saved.success) {
      logger.error(
        '[google-tokens] refresh succeeded but persist failed',
        new Error(saved.error ?? 'unknown'),
        { file: FILE },
      );
      return null;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? existing.refreshToken,
      expiryDate: newExpiryDate,
      scope: data.scope ?? existing.scope,
      connectedAt: existing.connectedAt,
      updatedAt: new Date().toISOString(),
      accountEmail: existing.accountEmail,
      gbpAccountId: existing.gbpAccountId,
      gbpLocationId: existing.gbpLocationId,
      gbpLocationName: existing.gbpLocationName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[google-tokens] refresh threw', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return null;
  }
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
