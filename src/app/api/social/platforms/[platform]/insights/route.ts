/**
 * API Route: Per-Platform AI Insights
 *
 * GET  /api/social/platforms/{platform}/insights
 *   Returns the saved insights doc from Firestore (or null when none exists).
 *   Never calls the LLM. Used by the component on mount.
 *
 * POST /api/social/platforms/{platform}/insights
 *   Generates fresh insights via the platform specialist, persists the result,
 *   and returns it. This is the "Generate / Refresh" path that costs tokens.
 *
 * Response shape (both methods on success):
 *   { success: true, insights: PlatformInsightsResult | null, generatedAt?: string,
 *     specialistId?: string, specialistName?: string | null, connected?: false }
 *   { success: false, error: string }
 *
 * All output is grounded in the specialist's Golden Master, which has Brand
 * DNA baked in (Standing Rule #1). Read-only — no GM mutation (Rule #2).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { generatePlatformInsights } from '@/lib/agents/marketing/platform-insights-service';
import { PlatformInsightsStorage } from '@/lib/social/platform-insights-storage';
import { SocialAccountService } from '@/lib/social/social-account-service';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function resolveAccount(platform: SocialPlatform) {
  const accounts = await SocialAccountService.listAccounts(platform);
  return accounts.find((a) => a.status === 'active') ?? accounts[0] ?? null;
}

async function applyGuards(
  request: NextRequest,
): Promise<NextResponse | null> {
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/insights');
  if (rl) { return rl; }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) { return auth; }

  return null;
}

// ─── GET — return saved doc (never calls LLM) ─────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;

    // Resolve connected account — mirrors the audience route pattern.
    const account = await resolveAccount(platform);
    if (!account) {
      return NextResponse.json({ success: true, insights: null, connected: false });
    }

    const saved = await PlatformInsightsStorage.getSaved(platform, account.id);
    if (!saved) {
      return NextResponse.json({ success: true, insights: null, connected: true });
    }

    return NextResponse.json({
      success: true,
      platform,
      connected: true,
      accountId: account.id,
      specialistId: saved.specialistId,
      specialistName: saved.specialistName,
      insights: saved.insights,
      generatedAt: saved.generatedAt,
    });
  } catch (error: unknown) {
    logger.error(
      'Platform Insights API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load saved insights' },
      { status: 500 },
    );
  }
}

// ─── POST — generate fresh insights and persist ───────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;
    const config = getPlatformConfig(platform);

    if (!config.specialistId) {
      return NextResponse.json(
        {
          success: false,
          error: `No specialist registered for ${platform}. Insights are unavailable until a platform specialist is built.`,
        },
        { status: 409 },
      );
    }

    if (config.state === 'parked') {
      return NextResponse.json(
        { success: false, error: `${platform} is parked — insights are disabled.` },
        { status: 409 },
      );
    }

    // Resolve connected account so we can key the storage doc correctly.
    const account = await resolveAccount(platform);
    const accountId = account?.id ?? 'default';

    const insights = await generatePlatformInsights({
      specialistId: config.specialistId,
      platform,
    });

    const generatedAt = new Date().toISOString();

    // Persist before returning — fire-and-catch so a storage error never
    // blocks the operator from seeing their freshly-generated insights.
    try {
      await PlatformInsightsStorage.saveInsights(platform, accountId, {
        insights,
        generatedAt,
        specialistId: config.specialistId,
        specialistName: config.specialistName,
      });
    } catch (storageError) {
      logger.warn('Platform Insights API: failed to persist insights to Firestore', {
        platform,
        accountId,
        error: storageError instanceof Error ? storageError.message : String(storageError),
      });
    }

    return NextResponse.json({
      success: true,
      platform,
      specialistId: config.specialistId,
      specialistName: config.specialistName,
      insights,
      generatedAt,
    });
  } catch (error: unknown) {
    logger.error(
      'Platform Insights API: POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    const message = error instanceof Error ? error.message : 'Failed to generate platform insights';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
