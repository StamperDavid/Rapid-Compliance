/**
 * Recovery Tracking API
 *
 * Records which channel brought a lead back (recovery source attribution).
 *
 * This is an intentionally public endpoint — unauthenticated leads click links
 * embedded in recovery emails/SMS and land here before they have a session.
 * Security is enforced via rate limiting (enumeration prevention) and strict
 * Zod validation of all inputs.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const pathParamsSchema = z.object({
  merchantId: z.string().min(1, 'merchantId is required'),
});

const querySchema = z.object({
  source: z.enum(['email_1', 'email_2', 'sms_1', 'voice_1', 'organic']).nullable().default(null),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  const onboardingUrl = new URL('/onboarding/industry', request.url);

  try {
    // Rate limiting — prevents merchantId enumeration by external actors
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/recovery/track');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Validate path params
    const rawParams = await params;
    const pathResult = pathParamsSchema.safeParse(rawParams);
    if (!pathResult.success) {
      return NextResponse.redirect(onboardingUrl);
    }
    const { merchantId } = pathResult.data;

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      source: searchParams.get('source'),
    });
    if (!queryResult.success) {
      return NextResponse.redirect(onboardingUrl);
    }
    const { source } = queryResult.data;

    // Dynamic import
    const { usePendingMerchantStore } = await import('@/lib/stores/pending-merchants-store');
    const { getRecoveryEngine } = await import('@/lib/recovery/recovery-engine');

    const store = usePendingMerchantStore.getState();
    const merchant = store.getMerchant(merchantId);

    if (merchant && source) {
      // Mark as recovered with source attribution
      store.markRecovered(source);

      // Cancel any pending recovery attempts
      const engine = getRecoveryEngine();
      engine.cancelCampaign(merchantId);

      logger.info(`[RecoveryTracking] Lead ${merchantId} recovered via ${source}`);
    }

    // Redirect to onboarding with recovery context
    const redirectUrl = new URL('/onboarding/industry', request.url);
    redirectUrl.searchParams.set('recovered', 'true');
    if (source) {
      redirectUrl.searchParams.set('source', source);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error: unknown) {
    logger.error('[RecoveryTracking] Error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.redirect(onboardingUrl);
  }
}
