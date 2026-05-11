/**
 * Google Ads API service
 *
 * Reads campaign spend + writes campaign-budget changes for BUDGET_STRATEGIST.
 * Uses the existing central Google OAuth (which already grants the
 * `https://www.googleapis.com/auth/adwords` scope per
 * GOOGLE_FULL_SCOPE_BUNDLE) plus a developer token + customer ID stored in
 * apiKeys.googleAds.
 *
 * The operator must do TWO things outside the app before this service works:
 *   1. Connect their Google account via the existing /api/integrations/google/auth flow.
 *      That gets us the OAuth access token with the adwords scope.
 *   2. Apply for a Google Ads developer token via https://ads.google.com/aw/apicenter,
 *      then enter the token + their customer ID via the settings page.
 *      Developer-token approval typically takes 1-5 business days for "basic" access
 *      (read + low-volume write); "standard" access takes weeks.
 *
 * REST API reference: https://developers.google.com/google-ads/api/rest/overview
 * Query language: GAQL (https://developers.google.com/google-ads/api/docs/query/overview)
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getConnectedGoogleTokens, refreshConnectedGoogleTokens } from '@/lib/integrations/google-tokens';
import { logger } from '@/lib/logger/logger';

const FILE = 'integrations/google-ads-service.ts';
const API_VERSION = 'v17';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

// ============================================================================
// CONFIG STORE — apiKeys/{org}.googleAds
// ============================================================================

interface GoogleAdsConfig {
  /** From the Google Ads API Center. */
  developerToken: string;
  /** The operator's Google Ads account ID (10 digits, may include dashes). */
  customerId: string;
  /** Optional manager-account ID (MCC) if the customer is managed under one. */
  loginCustomerId?: string;
  /** Last-saved-at ISO timestamp. */
  updatedAt: string;
}

const API_KEYS_COLLECTION = 'apiKeys';
const API_KEYS_DOC = 'rapid-compliance-root';

function normalizeCustomerId(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Read the Google Ads config from apiKeys/{org}.googleAds. Returns null
 * when not yet configured — callers should surface a "connect Google Ads"
 * CTA instead of attempting a call.
 */
export async function getGoogleAdsConfig(): Promise<GoogleAdsConfig | null> {
  if (!adminDb) {return null;}
  const path = getSubCollection(API_KEYS_COLLECTION);
  const snap = await adminDb.collection(path).doc(API_KEYS_DOC).get();
  if (!snap.exists) {return null;}
  const data = snap.data() as { googleAds?: Partial<GoogleAdsConfig> } | undefined;
  const cfg = data?.googleAds;
  if (!cfg?.developerToken || !cfg.customerId) {return null;}
  return {
    developerToken: cfg.developerToken,
    customerId: cfg.customerId,
    ...(cfg.loginCustomerId ? { loginCustomerId: cfg.loginCustomerId } : {}),
    updatedAt: cfg.updatedAt ?? '',
  };
}

export interface SaveGoogleAdsConfigInput {
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}

export async function saveGoogleAdsConfig(
  input: SaveGoogleAdsConfigInput,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {return { success: false, error: 'Firebase admin not initialized' };}
  if (!input.developerToken?.trim()) {return { success: false, error: 'developerToken is required' };}
  const customerId = normalizeCustomerId(input.customerId ?? '');
  if (customerId.length < 9 || customerId.length > 12) {
    return { success: false, error: 'customerId must be a 9-12 digit Google Ads account number' };
  }

  const payload: Partial<GoogleAdsConfig> = {
    developerToken: input.developerToken.trim(),
    customerId,
    updatedAt: new Date().toISOString(),
  };
  if (input.loginCustomerId?.trim()) {
    payload.loginCustomerId = normalizeCustomerId(input.loginCustomerId.trim());
  }

  const path = getSubCollection(API_KEYS_COLLECTION);
  await adminDb.collection(path).doc(API_KEYS_DOC).set({ googleAds: payload }, { merge: true });
  logger.info('[GoogleAds] config saved', { file: FILE, customerId, hasLoginCustomerId: Boolean(payload.loginCustomerId) });
  return { success: true };
}

export interface GoogleAdsStatus {
  configured: boolean;
  googleAccountConnected: boolean;
  hasAdwordsScope: boolean;
  developerToken: boolean;
  customerId?: string;
  loginCustomerId?: string;
  /** Plain-English diagnostic the settings UI can display. */
  diagnostic: string;
}

/**
 * Status snapshot: is Google connected, does it have the adwords scope, is
 * the dev token saved? The settings UI calls this to decide what step to
 * show next.
 */
export async function getGoogleAdsStatus(): Promise<GoogleAdsStatus> {
  const [tokens, config] = await Promise.all([getConnectedGoogleTokens(), getGoogleAdsConfig()]);

  const googleAccountConnected = Boolean(tokens?.accessToken);
  const hasAdwordsScope = (tokens?.scope ?? '').includes('https://www.googleapis.com/auth/adwords');
  const developerToken = Boolean(config?.developerToken);
  const customerId = config?.customerId;

  let diagnostic = '';
  if (!googleAccountConnected) {
    diagnostic = 'Connect your Google account first (Settings → Integrations → Google).';
  } else if (!hasAdwordsScope) {
    diagnostic = 'Your Google account is connected but doesn\'t have the Google Ads scope. Reconnect Google to grant it.';
  } else if (!developerToken) {
    diagnostic = 'Apply for a Google Ads developer token at https://ads.google.com/aw/apicenter, then paste it below.';
  } else if (!customerId) {
    diagnostic = 'Enter your Google Ads customer ID (10 digits, found in the top-right of ads.google.com).';
  } else {
    diagnostic = 'Google Ads is fully configured.';
  }

  return {
    configured: googleAccountConnected && hasAdwordsScope && developerToken && Boolean(customerId),
    googleAccountConnected,
    hasAdwordsScope,
    developerToken,
    customerId,
    loginCustomerId: config?.loginCustomerId,
    diagnostic,
  };
}

// ============================================================================
// API CLIENT
// ============================================================================

async function getAccessTokenOrRefresh(): Promise<string | null> {
  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {return null;}
  const now = Date.now();
  const isExpired = tokens.expiryDate !== null && tokens.expiryDate <= now + 30_000; // 30s grace
  if (isExpired) {
    const refreshed = await refreshConnectedGoogleTokens();
    return refreshed?.accessToken ?? null;
  }
  return tokens.accessToken;
}

interface GoogleAdsApiError {
  message: string;
  code?: number;
  status?: string;
}

async function callGoogleAdsApi<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ data?: T; error?: GoogleAdsApiError }> {
  const config = await getGoogleAdsConfig();
  if (!config) {return { error: { message: 'Google Ads not configured' } };}
  const accessToken = await getAccessTokenOrRefresh();
  if (!accessToken) {return { error: { message: 'Google account not connected (or refresh failed)' } };}

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': config.developerToken,
    'Content-Type': 'application/json',
  };
  if (config.loginCustomerId) {
    headers['login-customer-id'] = config.loginCustomerId;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const raw = (await res.json()) as unknown;
    if (!res.ok) {
      const errBody = raw as { error?: { message?: string; code?: number; status?: string } };
      return {
        error: {
          message: errBody.error?.message ?? `HTTP ${res.status}`,
          code: errBody.error?.code,
          status: errBody.error?.status,
        },
      };
    }
    return { data: raw as T };
  } catch (err) {
    return {
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

// ============================================================================
// READ — SPEND BY CAMPAIGN
// ============================================================================

export interface CampaignSpendRow {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  /** Campaign-level budget id, needed for budget mutations. */
  budgetId: string;
  /** Current daily budget in USD. */
  dailyBudgetUsd: number;
  /** Spend over the requested window. */
  costUsd: number;
  /** Conversion count Google attributes (may differ from CRM source counts). */
  conversions: number;
}

interface GaqlSearchResponse {
  results?: Array<{
    campaign?: {
      id?: string;
      name?: string;
      status?: string;
    };
    campaignBudget?: {
      resourceName?: string;
      amountMicros?: string;
    };
    metrics?: {
      costMicros?: string;
      conversions?: number | string;
    };
  }>;
}

function microsToUsd(micros: string | number | undefined): number {
  if (micros === undefined) {return 0;}
  const n = typeof micros === 'string' ? Number.parseFloat(micros) : micros;
  if (!Number.isFinite(n)) {return 0;}
  return n / 1_000_000;
}

function budgetIdFromResource(resourceName: string | undefined): string {
  if (!resourceName) {return '';}
  // shape: customers/{customerId}/campaignBudgets/{budgetId}
  const parts = resourceName.split('/');
  return parts[parts.length - 1] ?? '';
}

/**
 * Fetch per-campaign spend + budget over a date range. Date strings are
 * `YYYY-MM-DD` in the customer's account timezone.
 */
export async function fetchCampaignSpend(params: {
  startDate: string;
  endDate: string;
}): Promise<{ rows: CampaignSpendRow[]; error?: GoogleAdsApiError }> {
  const config = await getGoogleAdsConfig();
  if (!config) {return { rows: [], error: { message: 'Google Ads not configured' } };}

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.resource_name,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${params.startDate}' AND '${params.endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `.trim();

  const { data, error } = await callGoogleAdsApi<GaqlSearchResponse>(
    `/customers/${config.customerId}/googleAds:search`,
    { query },
  );
  if (error || !data) {return { rows: [], error };}

  const rows: CampaignSpendRow[] = (data.results ?? []).map((r) => ({
    campaignId: r.campaign?.id ?? '',
    campaignName: r.campaign?.name ?? '',
    campaignStatus: r.campaign?.status ?? '',
    budgetId: budgetIdFromResource(r.campaignBudget?.resourceName),
    dailyBudgetUsd: microsToUsd(r.campaignBudget?.amountMicros),
    costUsd: microsToUsd(r.metrics?.costMicros),
    conversions: typeof r.metrics?.conversions === 'string'
      ? Number.parseFloat(r.metrics.conversions)
      : (r.metrics?.conversions ?? 0),
  }));

  return { rows };
}

/**
 * Sum costUsd across all campaigns for a date range — used by the
 * BUDGET_STRATEGIST snapshot ("Google Ads spent $X over the last N days").
 */
export async function fetchTotalSpend(params: {
  startDate: string;
  endDate: string;
}): Promise<{ totalUsd: number; conversions: number; error?: GoogleAdsApiError }> {
  const { rows, error } = await fetchCampaignSpend(params);
  if (error) {return { totalUsd: 0, conversions: 0, error };}
  return {
    totalUsd: rows.reduce((acc, r) => acc + r.costUsd, 0),
    conversions: rows.reduce((acc, r) => acc + r.conversions, 0),
  };
}

// ============================================================================
// WRITE — UPDATE CAMPAIGN BUDGET
// ============================================================================

interface MutateBudgetResponse {
  results?: Array<{ resourceName?: string }>;
}

/**
 * Update a campaign budget's daily amount. Google Ads budgets are shared
 * resources (one budget can power multiple campaigns), so we mutate the
 * BUDGET, not the campaign. Caller provides budgetId (from CampaignSpendRow).
 *
 * Per the destructive-action standing rule, the route that calls this MUST
 * require two-step operator confirmation.
 */
export async function updateCampaignBudget(params: {
  budgetId: string;
  newDailyBudgetUsd: number;
}): Promise<{ success: boolean; error?: GoogleAdsApiError }> {
  const config = await getGoogleAdsConfig();
  if (!config) {return { success: false, error: { message: 'Google Ads not configured' } };}
  if (!params.budgetId) {return { success: false, error: { message: 'budgetId is required' } };}
  if (!Number.isFinite(params.newDailyBudgetUsd) || params.newDailyBudgetUsd < 0) {
    return { success: false, error: { message: 'newDailyBudgetUsd must be a non-negative number' } };
  }

  const amountMicros = Math.round(params.newDailyBudgetUsd * 1_000_000);
  const resourceName = `customers/${config.customerId}/campaignBudgets/${params.budgetId}`;

  const body = {
    operations: [
      {
        update: {
          resource_name: resourceName,
          amount_micros: String(amountMicros),
        },
        update_mask: 'amount_micros',
      },
    ],
  };

  const { data, error } = await callGoogleAdsApi<MutateBudgetResponse>(
    `/customers/${config.customerId}/campaignBudgets:mutate`,
    body,
  );

  if (error) {
    logger.error('[GoogleAds] updateCampaignBudget failed', new Error(error.message), {
      file: FILE,
      budgetId: params.budgetId,
      newDailyBudgetUsd: params.newDailyBudgetUsd,
    });
    return { success: false, error };
  }

  if (!data?.results?.[0]?.resourceName) {
    return { success: false, error: { message: 'Google Ads returned no result' } };
  }

  logger.info('[GoogleAds] campaign budget updated', {
    file: FILE,
    budgetId: params.budgetId,
    newDailyBudgetUsd: params.newDailyBudgetUsd,
  });
  return { success: true };
}
