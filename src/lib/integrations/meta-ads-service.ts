/**
 * Meta Ads (Facebook Marketing API) service
 *
 * Reads ad-set spend + writes ad-set budget changes for BUDGET_STRATEGIST.
 * Meta Ads requires its OWN OAuth flow with the `ads_management` permission
 * — separate from any organic FB/IG OAuth (those use `pages_manage_posts`,
 * `instagram_basic`, etc.). Tokens are stored in apiKeys.metaAds.
 *
 * Operator prerequisites (multi-day):
 *   1. Meta Business Verification complete.
 *   2. App with `ads_management` permission approved via App Review. Meta's
 *      review queue is days-to-weeks; the app must demonstrate a legitimate
 *      business use case for ads-management.
 *   3. Ad account ID (act_XXXXXXXXX) from Meta Business Manager.
 *
 * Token shape:
 *   - User access token (short-lived ~1hr) is exchanged at OAuth callback for
 *     a long-lived token (~60 days). Long-lived tokens auto-refresh on use
 *     within their window; expired tokens require operator re-OAuth.
 *
 * Marketing API reference: https://developers.facebook.com/docs/marketing-api
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { encryptToken, decryptToken } from '@/lib/security/token-encryption';
import { logger } from '@/lib/logger/logger';

const FILE = 'integrations/meta-ads-service.ts';
const API_VERSION = 'v19.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

const API_KEYS_COLLECTION = 'apiKeys';
const API_KEYS_DOC = 'rapid-compliance-root';

// ============================================================================
// CONFIG STORE — apiKeys/{org}.metaAds
// ============================================================================

interface StoredMetaAdsConfig {
  accessToken: string; // encrypted
  adAccountId: string; // act_XXXXXXXXX
  tokenExpiresAt: number | null; // epoch ms
  scope: string;
  connectedAt: string;
  updatedAt: string;
  userId: string; // FB user id from /me
  encrypted: true;
}

export interface MetaAdsConfig {
  accessToken: string; // decrypted
  adAccountId: string;
  tokenExpiresAt: number | null;
  scope: string;
  connectedAt: string;
  updatedAt: string;
  userId: string;
}

export async function getMetaAdsConfig(): Promise<MetaAdsConfig | null> {
  if (!adminDb) {return null;}
  const path = getSubCollection(API_KEYS_COLLECTION);
  const snap = await adminDb.collection(path).doc(API_KEYS_DOC).get();
  if (!snap.exists) {return null;}
  const data = snap.data() as { metaAds?: StoredMetaAdsConfig } | undefined;
  const cfg = data?.metaAds;
  if (!cfg?.accessToken || !cfg.adAccountId) {return null;}
  try {
    return {
      accessToken: decryptToken(cfg.accessToken),
      adAccountId: cfg.adAccountId,
      tokenExpiresAt: cfg.tokenExpiresAt ?? null,
      scope: cfg.scope ?? '',
      connectedAt: cfg.connectedAt ?? '',
      updatedAt: cfg.updatedAt ?? '',
      userId: cfg.userId ?? '',
    };
  } catch (err) {
    logger.error('[MetaAds] token decryption failed', err instanceof Error ? err : undefined, { file: FILE });
    return null;
  }
}

export interface SaveMetaAdsConfigInput {
  accessToken: string;
  adAccountId: string;
  tokenExpiresAt?: number | null;
  scope?: string;
  userId: string;
}

export async function saveMetaAdsConfig(
  input: SaveMetaAdsConfigInput,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {return { success: false, error: 'Firebase admin not initialized' };}
  if (!input.accessToken?.trim()) {return { success: false, error: 'accessToken is required' };}
  let normalizedAdAccount = input.adAccountId.trim();
  if (!normalizedAdAccount.startsWith('act_')) {normalizedAdAccount = `act_${normalizedAdAccount.replace(/[^0-9]/g, '')}`;}
  if (normalizedAdAccount === 'act_' || normalizedAdAccount.length < 8) {
    return { success: false, error: 'adAccountId must be act_XXXXXXXXX or 9-16 digits' };
  }

  const now = new Date().toISOString();
  const path = getSubCollection(API_KEYS_COLLECTION);
  const ref = adminDb.collection(path).doc(API_KEYS_DOC);
  const existing = await ref.get();
  const existingMeta = (existing.data() as { metaAds?: StoredMetaAdsConfig } | undefined)?.metaAds;

  const payload: StoredMetaAdsConfig = {
    accessToken: encryptToken(input.accessToken),
    adAccountId: normalizedAdAccount,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    scope: input.scope ?? '',
    connectedAt: existingMeta?.connectedAt ?? now,
    updatedAt: now,
    userId: input.userId,
    encrypted: true,
  };

  await ref.set({ metaAds: payload }, { merge: true });
  logger.info('[MetaAds] config saved', {
    file: FILE,
    adAccountId: normalizedAdAccount,
    hasTokenExpiry: payload.tokenExpiresAt !== null,
  });
  return { success: true };
}

// ============================================================================
// STATUS
// ============================================================================

export interface MetaAdsStatus {
  configured: boolean;
  tokenPresent: boolean;
  tokenExpired: boolean;
  adAccountId?: string;
  scope: string[];
  diagnostic: string;
}

export async function getMetaAdsStatus(): Promise<MetaAdsStatus> {
  const cfg = await getMetaAdsConfig();
  if (!cfg) {
    return {
      configured: false,
      tokenPresent: false,
      tokenExpired: false,
      scope: [],
      diagnostic: 'Connect Meta Ads — needs an Ads Management App Review approval first.',
    };
  }
  const tokenExpired = Boolean(cfg.tokenExpiresAt && cfg.tokenExpiresAt < Date.now());
  const scopeList = cfg.scope.split(/[\s,]/).filter(Boolean);
  const hasAdsManagement = scopeList.includes('ads_management');

  let diagnostic = '';
  if (tokenExpired) {diagnostic = 'Meta Ads token expired. Reconnect to refresh.';}
  else if (!hasAdsManagement) {diagnostic = 'Connected token lacks ads_management scope. Reconnect with a token that has it.';}
  else {diagnostic = `Meta Ads connected — ad account ${cfg.adAccountId}.`;}

  return {
    configured: !tokenExpired && hasAdsManagement,
    tokenPresent: true,
    tokenExpired,
    adAccountId: cfg.adAccountId,
    scope: scopeList,
    diagnostic,
  };
}

// ============================================================================
// API CLIENT
// ============================================================================

interface MetaApiError { message: string; code?: number; type?: string; }

async function callMetaApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; params?: Record<string, string>; body?: Record<string, unknown> } = {},
): Promise<{ data?: T; error?: MetaApiError }> {
  const cfg = await getMetaAdsConfig();
  if (!cfg) {return { error: { message: 'Meta Ads not configured' } };}
  if (cfg.tokenExpiresAt && cfg.tokenExpiresAt < Date.now()) {
    return { error: { message: 'Meta Ads token expired — operator must reconnect' } };
  }

  const params = new URLSearchParams({ access_token: cfg.accessToken, ...(options.params ?? {}) });
  const url = `${API_BASE}${path}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      ...(options.body ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
      } : {}),
    });
    const raw = (await res.json()) as unknown;
    if (!res.ok) {
      const errBody = raw as { error?: { message?: string; code?: number; type?: string } };
      return { error: { message: errBody.error?.message ?? `HTTP ${res.status}`, code: errBody.error?.code, type: errBody.error?.type } };
    }
    return { data: raw as T };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// ============================================================================
// READ — SPEND BY ADSET
// ============================================================================

export interface AdSetSpendRow {
  adsetId: string;
  adsetName: string;
  status: string;
  campaignId: string;
  campaignName: string;
  /** Current daily budget in USD (Meta returns minor units — cents for USD ad accounts). */
  dailyBudgetUsd: number;
  /** Spend over the requested window. */
  spendUsd: number;
  /** Meta-reported conversions (purchases, leads, etc.). */
  conversions: number;
}

interface InsightsResponse {
  data?: Array<{
    adset_id?: string;
    adset_name?: string;
    campaign_id?: string;
    campaign_name?: string;
    spend?: string;
    actions?: Array<{ action_type: string; value: string }>;
  }>;
}

interface AdSetsResponse {
  data?: Array<{
    id?: string;
    name?: string;
    status?: string;
    daily_budget?: string;
    campaign_id?: string;
  }>;
}

function minorToUsd(value: string | undefined): number {
  if (!value) {return 0;}
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) {return 0;}
  return n / 100;
}

function sumConversions(actions: Array<{ action_type: string; value: string }> | undefined): number {
  if (!actions) {return 0;}
  // Heuristic: count purchases + lead form completions + offsite conversions.
  // Real attribution should be operator-tuned per ad account; this is a sane default.
  const relevant = new Set([
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
    'offsite_conversion.fb_pixel_complete_registration',
  ]);
  return actions
    .filter((a) => relevant.has(a.action_type))
    .reduce((acc, a) => acc + (Number.parseFloat(a.value) || 0), 0);
}

/**
 * Fetch per-adset spend over a date range. Date strings are YYYY-MM-DD.
 *
 * Two API calls — one for insights (spend + actions), one for adsets (budget).
 * Joined on adset_id. Two calls is intentional: Meta's insights endpoint
 * doesn't return daily_budget reliably for all ad-account types.
 */
export async function fetchAdSetSpend(params: {
  startDate: string;
  endDate: string;
}): Promise<{ rows: AdSetSpendRow[]; error?: MetaApiError }> {
  const cfg = await getMetaAdsConfig();
  if (!cfg) {return { rows: [], error: { message: 'Meta Ads not configured' } };}

  const insightsRes = await callMetaApi<InsightsResponse>(`/${cfg.adAccountId}/insights`, {
    params: {
      level: 'adset',
      fields: 'adset_id,adset_name,campaign_id,campaign_name,spend,actions',
      time_range: JSON.stringify({ since: params.startDate, until: params.endDate }),
      limit: '500',
    },
  });
  if (insightsRes.error || !insightsRes.data) {return { rows: [], error: insightsRes.error };}

  const adsetsRes = await callMetaApi<AdSetsResponse>(`/${cfg.adAccountId}/adsets`, {
    params: {
      fields: 'id,name,status,daily_budget,campaign_id',
      limit: '500',
    },
  });
  if (adsetsRes.error || !adsetsRes.data) {return { rows: [], error: adsetsRes.error };}

  const adsetMeta = new Map<string, { status: string; dailyBudgetUsd: number; name: string }>();
  for (const a of adsetsRes.data.data ?? []) {
    if (!a.id) {continue;}
    adsetMeta.set(a.id, {
      status: a.status ?? '',
      dailyBudgetUsd: minorToUsd(a.daily_budget),
      name: a.name ?? '',
    });
  }

  const rows: AdSetSpendRow[] = (insightsRes.data.data ?? []).map((r) => {
    const meta = r.adset_id ? adsetMeta.get(r.adset_id) : undefined;
    return {
      adsetId: r.adset_id ?? '',
      adsetName: r.adset_name ?? meta?.name ?? '',
      status: meta?.status ?? '',
      campaignId: r.campaign_id ?? '',
      campaignName: r.campaign_name ?? '',
      dailyBudgetUsd: meta?.dailyBudgetUsd ?? 0,
      spendUsd: Number.parseFloat(r.spend ?? '0') || 0,
      conversions: sumConversions(r.actions),
    };
  });

  return { rows };
}

export async function fetchTotalSpend(params: {
  startDate: string;
  endDate: string;
}): Promise<{ totalUsd: number; conversions: number; error?: MetaApiError }> {
  const { rows, error } = await fetchAdSetSpend(params);
  if (error) {return { totalUsd: 0, conversions: 0, error };}
  return {
    totalUsd: rows.reduce((acc, r) => acc + r.spendUsd, 0),
    conversions: rows.reduce((acc, r) => acc + r.conversions, 0),
  };
}

// ============================================================================
// WRITE — UPDATE ADSET BUDGET
// ============================================================================

/**
 * Update an ad set's daily budget. Meta stores budgets in minor units (cents).
 * Per the destructive-action standing rule, the route calling this MUST
 * require two-step operator confirmation.
 */
export async function updateAdSetBudget(params: {
  adsetId: string;
  newDailyBudgetUsd: number;
}): Promise<{ success: boolean; error?: MetaApiError }> {
  if (!params.adsetId) {return { success: false, error: { message: 'adsetId is required' } };}
  if (!Number.isFinite(params.newDailyBudgetUsd) || params.newDailyBudgetUsd < 0) {
    return { success: false, error: { message: 'newDailyBudgetUsd must be a non-negative number' } };
  }
  const dailyBudgetMinor = Math.round(params.newDailyBudgetUsd * 100);

  const res = await callMetaApi<{ success?: boolean }>(`/${params.adsetId}`, {
    method: 'POST',
    body: { daily_budget: dailyBudgetMinor },
  });
  if (res.error) {
    logger.error('[MetaAds] updateAdSetBudget failed', new Error(res.error.message), {
      file: FILE,
      adsetId: params.adsetId,
      newDailyBudgetUsd: params.newDailyBudgetUsd,
    });
    return { success: false, error: res.error };
  }
  logger.info('[MetaAds] ad set budget updated', {
    file: FILE,
    adsetId: params.adsetId,
    newDailyBudgetUsd: params.newDailyBudgetUsd,
  });
  return { success: true };
}

// ============================================================================
// OAUTH HELPERS — used by the OAuth callback route
// ============================================================================

const GRAPH_OAUTH_BASE = 'https://www.facebook.com/v19.0/dialog/oauth';
const GRAPH_TOKEN_URL = `https://graph.facebook.com/${API_VERSION}/oauth/access_token`;

/** Build the OAuth authorize URL for Meta Ads. */
export function buildMetaAdsAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GRAPH_OAUTH_BASE);
  url.searchParams.set('client_id', params.appId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  // ads_management + ads_read covers spend reads + budget writes.
  // business_management lets us list ad accounts on the operator's business.
  url.searchParams.set('scope', 'ads_management,ads_read,business_management');
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/** Exchange a short-lived code for a short-lived user access token. */
export async function exchangeCodeForToken(params: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const url = new URL(GRAPH_TOKEN_URL);
  url.searchParams.set('client_id', params.appId);
  url.searchParams.set('client_secret', params.appSecret);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code', params.code);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !data.access_token) {
      return { error: data.error?.message ?? `Token exchange failed (HTTP ${res.status})` };
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown token-exchange error' };
  }
}

/** Exchange a short-lived token for a long-lived (~60d) one. */
export async function exchangeForLongLivedToken(params: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<{
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const url = new URL(GRAPH_TOKEN_URL);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', params.appId);
  url.searchParams.set('client_secret', params.appSecret);
  url.searchParams.set('fb_exchange_token', params.shortLivedToken);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !data.access_token) {
      return { error: data.error?.message ?? `Long-lived token exchange failed (HTTP ${res.status})` };
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown long-lived token error' };
  }
}

interface MeResponse { id?: string; name?: string; }

/** Get the FB user id for the token holder (used to tag the connection record). */
export async function getMetaUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/me?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) {return null;}
    const data = (await res.json()) as MeResponse;
    return data.id ?? null;
  } catch {
    return null;
  }
}

interface AdAccountsResponse {
  data?: Array<{ id?: string; name?: string; currency?: string; account_status?: number }>;
}

/** List the operator's ad accounts so they can pick which one to connect. */
export async function listAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string; currency: string; status: number }>> {
  try {
    const res = await fetch(
      `${API_BASE}/me/adaccounts?fields=id,name,currency,account_status&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) {return [];}
    const data = (await res.json()) as AdAccountsResponse;
    return (data.data ?? []).map((a) => ({
      id: a.id ?? '',
      name: a.name ?? '',
      currency: a.currency ?? '',
      status: a.account_status ?? 0,
    }));
  } catch {
    return [];
  }
}
