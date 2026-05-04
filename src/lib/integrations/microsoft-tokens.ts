/**
 * Microsoft Tokens — Central token store for the connected Microsoft account.
 *
 * Mirror of `google-tokens.ts`. One Microsoft (Azure AD) OAuth grants the
 * platform access to Outlook Mail + Outlook Calendar + OneDrive + Teams via
 * Microsoft Graph. All Microsoft-touching services read tokens from a single
 * Firestore document so the operator does not have to re-OAuth per service.
 *
 * Doc path: `organizations/{tenantId}/connectedAccounts/microsoft`
 *   - Single-tenant phase: PLATFORM_ID is the only tenant.
 *   - Multi-tenant flip: each tenant has their own subtree under
 *     `organizations/{tenantId}/connectedAccounts/microsoft`.
 *
 * Tokens are stored encrypted (same `encryptToken` helper used everywhere
 * else). Callers receive decrypted tokens via `getConnectedMicrosoftTokens()`.
 *
 * Backward-compat: the legacy `integrations/{id}` writes are preserved during
 * migration so existing Outlook/Teams/Calendar consumers keep working until
 * each is migrated to read from this central store.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { encryptToken, decryptToken } from '@/lib/security/token-encryption';
import { logger } from '@/lib/logger/logger';

const FILE = 'integrations/microsoft-tokens.ts';
const COLLECTION = 'connectedAccounts';
const DOC_ID = 'microsoft';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * Decrypted, ready-to-use Microsoft OAuth tokens for the connected account.
 * Returned by `getConnectedMicrosoftTokens()`. Callers pass `accessToken`
 * directly to Microsoft Graph as a Bearer token.
 */
export interface ConnectedMicrosoftTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Unix-epoch milliseconds; null if Microsoft didn't return one. */
  expiryDate: number | null;
  /** Space-separated list of scopes the operator granted at consent. */
  scope: string;
  /** ISO timestamp when the OAuth flow completed. */
  connectedAt: string;
  /** ISO timestamp of the most recent token write (initial or refresh). */
  updatedAt: string;
  /**
   * The Microsoft account email derived during OAuth (via Graph /me).
   * Used as the FROM address for Outlook sends and the calendar identity
   * for event writes. Empty string if not yet resolved.
   */
  accountEmail: string;
}

/**
 * Stored shape (with encrypted tokens). Internal — callers should not deal
 * with encrypted strings, they get the decrypted shape via
 * `getConnectedMicrosoftTokens()`.
 */
interface StoredMicrosoftTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  scope: string;
  connectedAt: string;
  updatedAt: string;
  accountEmail: string;
  encrypted: true;
}

export interface SaveConnectedMicrosoftTokensInput {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  scope?: string;
  accountEmail?: string;
}

/**
 * Persist the operator's Microsoft OAuth tokens to the central store.
 * Called by the OAuth callback handler after a successful code-exchange.
 * Tokens are encrypted at rest.
 */
export async function saveConnectedMicrosoftTokens(
  input: SaveConnectedMicrosoftTokensInput,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firebase admin not initialized' };
  }
  if (!input.accessToken || input.accessToken.trim().length === 0) {
    return { success: false, error: 'accessToken is required' };
  }

  const now = new Date().toISOString();

  const doc: StoredMicrosoftTokens = {
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
    // Preserve `connectedAt` if the doc already exists so we don't reset
    // the original OAuth date on every token refresh.
    const ref = adminDb.collection(path).doc(DOC_ID);
    const existing = await ref.get();
    if (existing.exists) {
      const existingData = existing.data() as Partial<StoredMicrosoftTokens> | undefined;
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
    logger.info('[microsoft-tokens] saved connected Microsoft account tokens', {
      file: FILE,
      hasRefreshToken: doc.refreshToken !== null,
      expiryDate: doc.expiryDate,
      scopeBytes: doc.scope.length,
      accountEmail: doc.accountEmail,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[microsoft-tokens] save failed', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return { success: false, error: msg };
  }
}

/**
 * Read + decrypt the operator's connected Microsoft tokens.
 * Returns null if no Microsoft account is connected.
 */
export async function getConnectedMicrosoftTokens(): Promise<ConnectedMicrosoftTokens | null> {
  if (!adminDb) {
    logger.warn('[microsoft-tokens] adminDb not available', { file: FILE });
    return null;
  }
  try {
    const path = getSubCollection(COLLECTION);
    const snap = await adminDb.collection(path).doc(DOC_ID).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data() as Partial<StoredMicrosoftTokens> | undefined;
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
    logger.error('[microsoft-tokens] read failed', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return null;
  }
}

/**
 * Convenience: get just the account email (used as FROM address).
 * Returns empty string if no account is connected — callers should surface
 * a "connect Microsoft" CTA in that case rather than send.
 */
export async function getConnectedMicrosoftAccountEmail(): Promise<string> {
  const tokens = await getConnectedMicrosoftTokens();
  return tokens?.accountEmail ?? '';
}

/**
 * Refresh the connected Microsoft access token using the stored refresh
 * token, then persist the new access token (and any new refresh token
 * Microsoft rotates in) back to the central store.
 *
 * Returns the freshly-refreshed tokens on success, or null if:
 *   - No Microsoft account is connected
 *   - The stored refresh token is missing
 *   - MICROSOFT_CLIENT_ID/SECRET env vars are missing
 *   - Microsoft's token endpoint rejects the refresh
 *
 * Callers (e.g., per-service Outlook/Teams) should treat a null return as
 * "operator must reconnect Microsoft" — a refresh failure typically means
 * the operator revoked access or the refresh token expired.
 */
export async function refreshConnectedMicrosoftTokens(): Promise<ConnectedMicrosoftTokens | null> {
  const existing = await getConnectedMicrosoftTokens();
  if (!existing) {
    logger.warn('[microsoft-tokens] refresh requested but no connected Microsoft account', {
      file: FILE,
    });
    return null;
  }
  if (!existing.refreshToken) {
    logger.warn('[microsoft-tokens] refresh requested but no refresh token stored', {
      file: FILE,
    });
    return null;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error(
      '[microsoft-tokens] cannot refresh — MICROSOFT_CLIENT_ID/SECRET not set',
      new Error('missing microsoft oauth env'),
      { file: FILE },
    );
    return null;
  }

  try {
    const res = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: existing.refreshToken,
        grant_type: 'refresh_token',
        scope: existing.scope.length > 0
          ? existing.scope
          : MICROSOFT_FULL_SCOPE_BUNDLE.join(' '),
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
        '[microsoft-tokens] refresh failed at Microsoft token endpoint',
        new Error(errMsg),
        { file: FILE },
      );
      return null;
    }

    const newExpiryDate = typeof data.expires_in === 'number'
      ? Date.now() + data.expires_in * 1000
      : null;

    const saved = await saveConnectedMicrosoftTokens({
      accessToken: data.access_token,
      // Microsoft rotates refresh tokens on every refresh; keep the
      // existing one if no new value is returned in the response (rare
      // but defensive).
      refreshToken: data.refresh_token ?? existing.refreshToken,
      expiryDate: newExpiryDate,
      scope: data.scope ?? existing.scope,
      accountEmail: existing.accountEmail,
    });

    if (!saved.success) {
      logger.error(
        '[microsoft-tokens] refresh succeeded but persist failed',
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
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[microsoft-tokens] refresh threw', err instanceof Error ? err : new Error(msg), {
      file: FILE,
    });
    return null;
  }
}

/**
 * The full scope bundle requested when the operator connects Microsoft
 * during onboarding. One consent screen covers every Microsoft service the
 * platform integrates with so they don't have to re-OAuth per feature later.
 *
 * Order matters for the consent UI — Microsoft groups by resource, so we
 * list scopes for one resource contiguously. New scopes added here
 * automatically apply to future operator connections; existing connections
 * need to re-OAuth to grant the new scope.
 */
export const MICROSOFT_FULL_SCOPE_BUNDLE: readonly string[] = [
  // Outlook Mail — read replies, send via Graph, modify mailbox settings
  // (signature, automatic-reply rules).
  'Mail.ReadWrite',
  'Mail.Send',
  'MailboxSettings.ReadWrite',
  // Outlook Calendar — read existing events for conflict detection, write
  // new events for every scheduled platform action. Calendars.ReadWrite
  // covers events + free/busy.
  'Calendars.ReadWrite',
  // OneDrive — file storage for generated content, brand assets, exports.
  'Files.ReadWrite',
  // Teams — list teams + channels the operator belongs to, post basic
  // channel messages. Wider Teams scopes (chats, meetings) require admin
  // consent and aren't needed for MVP.
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'ChannelMessage.Send',
  // Identity — needed to capture the operator's account email for use as
  // the FROM address on emails / calendar invites. `User.Read` returns the
  // /me payload; openid/email/profile are standard OIDC scopes for token
  // exchange and userinfo.
  'User.Read',
  'openid',
  'email',
  'profile',
  // Refresh-token issuance — without this Microsoft doesn't return a
  // refresh_token and every access-token expiry forces a re-auth.
  'offline_access',
];
