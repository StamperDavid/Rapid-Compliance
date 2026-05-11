/**
 * Cron — Refresh BUDGET_STRATEGIST recommendations hourly.
 *
 * Pulls fresh spend (from connected ad platforms) + fresh conversions (from
 * CRM source attribution), feeds them into BUDGET_STRATEGIST, persists the
 * result as a new snapshot with createdBy='cron'.
 *
 * Uses the LATEST operator-created snapshot's inputs (totalBudgetUsd,
 * windowDays, platform list) as the template — refreshing in place rather
 * than asking the cron to invent budgets. If no operator-created snapshot
 * exists yet, exits early with a clear status (cron has nothing to refresh
 * until the operator runs at least one manual analysis).
 *
 * Schedule: `0 * * * *` (top of every hour) per vercel.json.
 *
 * Auth: Vercel CRON_SECRET via verifyCronAuth().
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { runBudgetStrategist } from '@/lib/agents/marketing/budget/specialist';
import {
  listSnapshots,
  persistBudgetSnapshot,
} from '@/lib/marketing/budget-snapshot-service';
import { aggregateConversionsByPlatform } from '@/lib/marketing/budget-conversion-aggregator';
import {
  getGoogleAdsConfig,
  fetchTotalSpend as fetchGoogleAdsTotalSpend,
} from '@/lib/integrations/google-ads-service';
import {
  getMetaAdsConfig,
  fetchTotalSpend as fetchMetaAdsTotalSpend,
} from '@/lib/integrations/meta-ads-service';
import type { PlatformSpendSnapshot, ConversionSource } from '@/types/budget-strategist';

const ROUTE = '/api/cron/budget-strategist-refresh';

function dateRange(windowDays: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
  if (rateLimitResponse) {return rateLimitResponse;}

  const authError = verifyCronAuth(request, ROUTE);
  if (authError) {return authError;}

  const startedAt = Date.now();
  logger.info('[BudgetCron] starting refresh', { route: ROUTE });

  try {
    // Find the most recent OPERATOR-created snapshot to use as our template.
    // Cron-created snapshots don't count — we don't want each hour's cron run
    // to redefine the budget; we want to refresh against the operator's last
    // declared budget + platform list.
    const recent = await listSnapshots(20);
    const operatorSnapshot = recent.find((s) => s.createdBy === 'operator');
    if (!operatorSnapshot) {
      logger.info('[BudgetCron] no operator snapshot yet — nothing to refresh', { route: ROUTE });
      return NextResponse.json({
        success: true,
        outcome: 'no_operator_template',
        message: 'No operator-created snapshot exists yet. Cron has nothing to refresh against.',
      });
    }

    const templateInputs = operatorSnapshot.inputs;
    const { startDate, endDate } = dateRange(templateInputs.windowDays);

    // 1. Fresh conversion attribution from the CRM (UTM-attributed leads).
    const conversionAgg = await aggregateConversionsByPlatform(templateInputs.windowDays);
    const conversionsByPlatform = new Map(
      conversionAgg.byPlatform.map((p) => [p.platform.toLowerCase(), p.count]),
    );

    // 2. Fresh spend numbers from each connected ad platform.
    let googleAdsSpend: { spendUsd: number; conversions: number } | null = null;
    if (await getGoogleAdsConfig()) {
      const { totalUsd, conversions, error } = await fetchGoogleAdsTotalSpend({ startDate, endDate });
      if (error) {
        logger.warn('[BudgetCron] Google Ads spend fetch errored', { route: ROUTE, error: error.message });
      } else {
        googleAdsSpend = { spendUsd: totalUsd, conversions };
      }
    }

    let metaAdsSpend: { spendUsd: number; conversions: number } | null = null;
    if (await getMetaAdsConfig()) {
      const { totalUsd, conversions, error } = await fetchMetaAdsTotalSpend({ startDate, endDate });
      if (error) {
        logger.warn('[BudgetCron] Meta Ads spend fetch errored', { route: ROUTE, error: error.message });
      } else {
        metaAdsSpend = { spendUsd: totalUsd, conversions };
      }
    }

    // 3. Build refreshed platforms array.
    // For each platform in the operator's template, swap in fresh numbers
    // where available; keep template values as fallback. Trust order on
    // conversions stays consistent (CRM wins over platform self-report).
    const refreshedPlatforms: PlatformSpendSnapshot[] = templateInputs.platforms.map((p) => {
      const key = p.platform.toLowerCase();
      const crmConversions = conversionsByPlatform.get(key);

      let liveSpend: number | undefined;
      let livePlatformConversions: number | undefined;
      if (key === 'google_ads' && googleAdsSpend) {
        liveSpend = googleAdsSpend.spendUsd;
        livePlatformConversions = googleAdsSpend.conversions;
      } else if (key === 'meta_ads' && metaAdsSpend) {
        liveSpend = metaAdsSpend.spendUsd;
        livePlatformConversions = metaAdsSpend.conversions;
      }

      // Conversion-source policy:
      //   - If CRM has any attribution for this platform, use it as the
      //     primary number (high trust).
      //   - Else keep the operator's last-entered value (medium trust).
      //   - Either way, populate platformReportedConversions if the platform
      //     returned one — the strategist uses it as a sanity-check signal.
      const conversionSource: ConversionSource = typeof crmConversions === 'number' ? 'crm' : p.conversionSource;
      const conversions = typeof crmConversions === 'number' ? crmConversions : p.conversions;

      return {
        ...p,
        currentSpendUsd: liveSpend ?? p.currentSpendUsd,
        conversions,
        conversionSource,
        ...(typeof livePlatformConversions === 'number'
          ? { platformReportedConversions: livePlatformConversions }
          : {}),
      };
    });

    const refreshedRequest = {
      action: 'analyze_budget' as const,
      totalBudgetUsd: templateInputs.totalBudgetUsd,
      windowDays: templateInputs.windowDays,
      platforms: refreshedPlatforms,
      previousAllocation: Object.fromEntries(
        operatorSnapshot.result.recommendations.map((r) => [r.platform, r.recommendedSpendUsd]),
      ),
    };

    // 4. Run the agent + persist the new snapshot.
    const result = await runBudgetStrategist(refreshedRequest);
    const snapshotId = await persistBudgetSnapshot({
      inputs: refreshedRequest,
      result,
      createdBy: 'cron',
      modelUsed: 'claude-sonnet-4.6',
    });

    const elapsedMs = Date.now() - startedAt;
    logger.info('[BudgetCron] refresh complete', {
      route: ROUTE,
      snapshotId,
      operatorTemplate: operatorSnapshot.id,
      elapsedMs,
      googleAdsConnected: googleAdsSpend !== null,
      metaAdsConnected: metaAdsSpend !== null,
    });

    return NextResponse.json({
      success: true,
      outcome: 'refreshed',
      snapshotId,
      operatorTemplateId: operatorSnapshot.id,
      elapsedMs,
      googleAdsConnected: googleAdsSpend !== null,
      metaAdsConnected: metaAdsSpend !== null,
      crmConversionsTotal: conversionAgg.leadsWithSource,
    });
  } catch (err) {
    logger.error(
      '[BudgetCron] refresh failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
