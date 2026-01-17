/**
 * Recovery Tracking API
 *
 * Records which channel brought a lead back (recovery source attribution).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as 'email_1' | 'email_2' | 'sms_1' | 'voice_1' | null;

    if (!merchantId) {
      return NextResponse.redirect(new URL('/onboarding/industry', request.url));
    }

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
    logger.error('[RecoveryTracking] Error:', error instanceof Error ? error : undefined);
    return NextResponse.redirect(new URL('/onboarding/industry', request.url));
  }
}
