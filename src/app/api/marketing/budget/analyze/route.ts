/**
 * Marketing Budget Analyze API
 *
 * POST /api/marketing/budget/analyze
 *   Wraps `runBudgetStrategist()`. Operator submits a per-platform spend
 *   snapshot + a total budget; returns recommendations + summary +
 *   insufficient-data flag.
 *
 * Gated by requireRole(['owner', 'admin']) — marketing budget allocation
 * is high-impact, even read-only "tell me what to spend" output should
 * not leak to non-admin tenants.
 *
 * The route does NOT move money. Apply happens client-side via the
 * existing Mission Control / Jasper path. See /marketing/budget page.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { runBudgetStrategist } from '@/lib/agents/marketing/budget/specialist';
import { persistBudgetSnapshot } from '@/lib/marketing/budget-snapshot-service';
import type { AnalyzeBudgetRequest } from '@/types/budget-strategist';

export const dynamic = 'force-dynamic';

const PlatformSnapshotSchema = z.object({
  platform: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120),
  currentSpendUsd: z.number().nonnegative().max(10_000_000),
  conversions: z.number().nonnegative().max(10_000_000),
  conversionSource: z.enum(['crm', 'ga4', 'platform_self_reported']),
  platformReportedConversions: z.number().nonnegative().max(10_000_000).optional(),
  requiresManualBudgetChange: z.boolean().optional(),
});

const AnalyzeBudgetSchema = z.object({
  totalBudgetUsd: z.number().positive().max(10_000_000),
  windowDays: z.number().int().positive().max(365),
  platforms: z.array(PlatformSnapshotSchema).min(1).max(20),
  previousAllocation: z.record(z.string(), z.number()).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const body: unknown = await request.json();
    const parsed = AnalyzeBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const req: AnalyzeBudgetRequest = {
      action: 'analyze_budget',
      totalBudgetUsd: parsed.data.totalBudgetUsd,
      windowDays: parsed.data.windowDays,
      platforms: parsed.data.platforms,
      previousAllocation: parsed.data.previousAllocation,
    };

    const result = await runBudgetStrategist(req);

    // Persist for the dashboard widget + history. Snapshot persistence
    // must NOT fail the request — the operator already paid for the LLM
    // call, so we return the result even if the write hiccups.
    let snapshotId: string | null = null;
    try {
      snapshotId = await persistBudgetSnapshot({
        inputs: req,
        result,
        createdBy: 'operator',
        userId: authResult.user.uid,
      });
    } catch (snapshotErr) {
      logger.warn('[BudgetAnalyzeAPI] snapshot persist failed (result still returned)', {
        error: snapshotErr instanceof Error ? snapshotErr.message : String(snapshotErr),
      });
    }

    return NextResponse.json({
      success: true,
      result,
      ...(snapshotId ? { snapshotId } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(
      '[BudgetAnalyzeAPI] runBudgetStrategist failed',
      err instanceof Error ? err : undefined,
      { route: '/api/marketing/budget/analyze' },
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
