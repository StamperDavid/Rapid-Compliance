/**
 * Budget Apply service
 *
 * Translates a BUDGET_STRATEGIST recommendation into actual API calls
 * against the underlying ad-platform. The agent recommends per-PLATFORM
 * totals (e.g., "Google Ads $2300"), but the platforms operate at the
 * campaign-budget / ad-set level. This service scales the existing
 * campaign/adset budgets PROPORTIONALLY to the new total, preserving the
 * operator's existing campaign mix.
 *
 * For platforms WITHOUT a budget API (SEO retainers, Google LSA, etc.),
 * the recommendation comes back with requiresManualMissionTask=true and the
 * Apply path returns the mission prompt for the operator to copy into Jasper.
 *
 * Per the destructive-action standing rule, the route calling this MUST
 * require two-step operator confirmation BEFORE invoking applyRecommendation.
 */

import { logger } from '@/lib/logger/logger';
import {
  getGoogleAdsConfig,
  fetchCampaignSpend,
  updateCampaignBudget,
} from '@/lib/integrations/google-ads-service';
import {
  getMetaAdsConfig,
  fetchAdSetSpend,
  updateAdSetBudget,
} from '@/lib/integrations/meta-ads-service';
import type { BudgetRecommendation } from '@/types/budget-strategist';

const FILE = 'marketing/budget-apply-service.ts';

/**
 * Platforms that support an automated apply path. The recommendation's
 * `platform` key must match one of these for the Apply button to fire an
 * API call. Other platforms return a manual mission prompt.
 */
const AUTO_APPLY_PLATFORMS = new Set(['google_ads', 'meta_ads']);

export interface ApplyResult {
  /** What the apply path actually did. */
  outcome: 'auto_applied' | 'manual_mission_required' | 'not_configured' | 'no_active_campaigns' | 'partial_failure' | 'failed';
  /** Plain-English summary the UI can render. */
  summary: string;
  /** Per-leaf detail (campaigns or ad sets affected). */
  details?: Array<{
    leafId: string;
    leafName: string;
    previousBudgetUsd: number;
    newBudgetUsd: number;
    success: boolean;
    error?: string;
  }>;
  /** For manual platforms: the mission prompt the operator copies to Jasper. */
  missionPrompt?: string;
}

/**
 * Compute proportional budgets: distribute `targetTotal` across `leaves`
 * in proportion to their current budgets. If all current budgets are zero,
 * distribute evenly.
 */
function proportionalDistribute(
  leaves: Array<{ id: string; currentDailyBudgetUsd: number }>,
  targetTotalDailyUsd: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (leaves.length === 0) {return result;}

  const sumCurrent = leaves.reduce((acc, l) => acc + l.currentDailyBudgetUsd, 0);
  if (sumCurrent <= 0) {
    const each = targetTotalDailyUsd / leaves.length;
    for (const l of leaves) {result.set(l.id, Math.round(each * 100) / 100);}
    return result;
  }

  let allocated = 0;
  // Allocate proportionally, rounding to cents. Track residual.
  leaves.forEach((l, i) => {
    if (i === leaves.length - 1) {
      // Last leaf takes the remainder to ensure exact-total preservation.
      const remainder = Math.max(0, targetTotalDailyUsd - allocated);
      result.set(l.id, Math.round(remainder * 100) / 100);
    } else {
      const share = (l.currentDailyBudgetUsd / sumCurrent) * targetTotalDailyUsd;
      const rounded = Math.round(share * 100) / 100;
      allocated += rounded;
      result.set(l.id, rounded);
    }
  });
  return result;
}

/**
 * Convert a per-window recommendation to a daily budget number. The
 * recommendation's `recommendedSpendUsd` is the TOTAL spend for the
 * `windowDays` window; platform budgets are typically DAILY. We use a
 * straight divide which works for steady-pacing campaigns; lifetime-budget
 * campaigns would need different handling (not addressed here).
 */
export function windowSpendToDailyBudget(spendUsd: number, windowDays: number): number {
  if (!Number.isFinite(spendUsd) || !Number.isFinite(windowDays) || windowDays <= 0) {return 0;}
  return Math.round((spendUsd / windowDays) * 100) / 100;
}

interface ApplyContext {
  windowDays: number;
}

async function applyGoogleAds(
  recommendation: BudgetRecommendation,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  const cfg = await getGoogleAdsConfig();
  if (!cfg) {
    return {
      outcome: 'not_configured',
      summary: 'Google Ads is not configured. Open Settings → Integrations → Marketing Ads to connect.',
    };
  }

  // Pull the operator's current campaign mix over the same window the
  // recommendation covered.
  const today = new Date();
  const since = new Date(today.getTime() - ctx.windowDays * 24 * 60 * 60 * 1000);
  const startDate = since.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  const { rows, error } = await fetchCampaignSpend({ startDate, endDate });
  if (error) {
    return { outcome: 'failed', summary: `Could not load Google Ads campaigns: ${error.message}` };
  }

  const activeCampaigns = rows.filter((r) => r.campaignStatus === 'ENABLED' && r.budgetId);
  if (activeCampaigns.length === 0) {
    return {
      outcome: 'no_active_campaigns',
      summary: 'No active Google Ads campaigns to update. Enable a campaign in Google Ads before applying.',
    };
  }

  // De-dupe by budgetId — many campaigns share a budget on Google Ads.
  const budgetMap = new Map<string, { id: string; currentDailyBudgetUsd: number; name: string }>();
  for (const c of activeCampaigns) {
    const existing = budgetMap.get(c.budgetId);
    if (!existing) {
      budgetMap.set(c.budgetId, {
        id: c.budgetId,
        currentDailyBudgetUsd: c.dailyBudgetUsd,
        name: c.campaignName,
      });
    }
  }
  const budgetLeaves = Array.from(budgetMap.values());

  const newDailyTotal = windowSpendToDailyBudget(recommendation.recommendedSpendUsd, ctx.windowDays);
  const allocations = proportionalDistribute(
    budgetLeaves.map((b) => ({ id: b.id, currentDailyBudgetUsd: b.currentDailyBudgetUsd })),
    newDailyTotal,
  );

  // Fire mutations sequentially — Google Ads quota recovers per second,
  // parallel writes risk RATE_EXCEEDED.
  const details: NonNullable<ApplyResult['details']> = [];
  let anyFailures = false;
  for (const leaf of budgetLeaves) {
    const newAmount = allocations.get(leaf.id) ?? 0;
    const result = await updateCampaignBudget({ budgetId: leaf.id, newDailyBudgetUsd: newAmount });
    details.push({
      leafId: leaf.id,
      leafName: leaf.name,
      previousBudgetUsd: leaf.currentDailyBudgetUsd,
      newBudgetUsd: newAmount,
      success: result.success,
      ...(result.error ? { error: result.error.message } : {}),
    });
    if (!result.success) {anyFailures = true;}
  }

  if (anyFailures) {
    return {
      outcome: 'partial_failure',
      summary: `Some Google Ads budgets failed to update. ${details.filter((d) => d.success).length}/${details.length} succeeded.`,
      details,
    };
  }

  return {
    outcome: 'auto_applied',
    summary: `Google Ads — updated ${details.length} budget${details.length === 1 ? '' : 's'} to a new daily total of $${newDailyTotal.toLocaleString()} (split proportionally across active campaigns).`,
    details,
  };
}

async function applyMetaAds(
  recommendation: BudgetRecommendation,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  const cfg = await getMetaAdsConfig();
  if (!cfg) {
    return {
      outcome: 'not_configured',
      summary: 'Meta Ads is not configured. Open Settings → Integrations → Marketing Ads to connect.',
    };
  }

  const today = new Date();
  const since = new Date(today.getTime() - ctx.windowDays * 24 * 60 * 60 * 1000);
  const startDate = since.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  const { rows, error } = await fetchAdSetSpend({ startDate, endDate });
  if (error) {
    return { outcome: 'failed', summary: `Could not load Meta Ads ad sets: ${error.message}` };
  }

  const activeAdSets = rows.filter((r) => r.status === 'ACTIVE' && r.adsetId);
  if (activeAdSets.length === 0) {
    return {
      outcome: 'no_active_campaigns',
      summary: 'No active Meta Ads ad sets to update. Enable an ad set in Meta Business Manager before applying.',
    };
  }

  const newDailyTotal = windowSpendToDailyBudget(recommendation.recommendedSpendUsd, ctx.windowDays);
  const allocations = proportionalDistribute(
    activeAdSets.map((a) => ({ id: a.adsetId, currentDailyBudgetUsd: a.dailyBudgetUsd })),
    newDailyTotal,
  );

  const details: NonNullable<ApplyResult['details']> = [];
  let anyFailures = false;
  for (const adset of activeAdSets) {
    const newAmount = allocations.get(adset.adsetId) ?? 0;
    const result = await updateAdSetBudget({ adsetId: adset.adsetId, newDailyBudgetUsd: newAmount });
    details.push({
      leafId: adset.adsetId,
      leafName: adset.adsetName,
      previousBudgetUsd: adset.dailyBudgetUsd,
      newBudgetUsd: newAmount,
      success: result.success,
      ...(result.error ? { error: result.error.message } : {}),
    });
    if (!result.success) {anyFailures = true;}
  }

  if (anyFailures) {
    return {
      outcome: 'partial_failure',
      summary: `Some Meta Ads budgets failed to update. ${details.filter((d) => d.success).length}/${details.length} succeeded.`,
      details,
    };
  }

  return {
    outcome: 'auto_applied',
    summary: `Meta Ads — updated ${details.length} ad set${details.length === 1 ? '' : 's'} to a new daily total of $${newDailyTotal.toLocaleString()} (split proportionally across active sets).`,
    details,
  };
}

/**
 * Apply a single recommendation. The route calling this MUST require
 * two-step operator confirmation per the destructive-actions rule.
 */
export async function applyRecommendation(
  recommendation: BudgetRecommendation,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  if (recommendation.requiresManualMissionTask) {
    return {
      outcome: 'manual_mission_required',
      summary: `${recommendation.displayName} doesn't have a budget API — copy the mission prompt to Jasper to make the change manually.`,
      missionPrompt: recommendation.manualMissionPrompt ?? '',
    };
  }

  const platform = recommendation.platform.toLowerCase();

  if (!AUTO_APPLY_PLATFORMS.has(platform)) {
    return {
      outcome: 'manual_mission_required',
      summary: `Auto-apply for ${recommendation.displayName} isn't supported yet. Copy the mission prompt to Jasper.`,
      missionPrompt: recommendation.manualMissionPrompt ?? '',
    };
  }

  logger.info('[BudgetApply] applying recommendation', {
    file: FILE,
    platform,
    recommendedSpendUsd: recommendation.recommendedSpendUsd,
    windowDays: ctx.windowDays,
  });

  if (platform === 'google_ads') {return applyGoogleAds(recommendation, ctx);}
  if (platform === 'meta_ads') {return applyMetaAds(recommendation, ctx);}

  return {
    outcome: 'manual_mission_required',
    summary: `Platform "${platform}" isn't wired for auto-apply.`,
  };
}
