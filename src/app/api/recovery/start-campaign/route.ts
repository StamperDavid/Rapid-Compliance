/**
 * Recovery Campaign API
 *
 * Triggers multi-channel recovery siege when a lead abandons.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const RecoveryCampaignSchema = z.object({
  merchantId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = RecoveryCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { merchantId } = parsed.data;

    // Dynamic import to avoid build issues
    const { usePendingMerchantStore } = await import('@/lib/stores/pending-merchants-store');
    const { getRecoveryEngine } = await import('@/lib/recovery/recovery-engine');

    const merchant = usePendingMerchantStore.getState().getMerchant(merchantId);

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Start recovery campaign
    const engine = getRecoveryEngine();
    engine.startRecoveryCampaign(merchant);

    return NextResponse.json({
      success: true,
      message: 'Recovery campaign started',
      merchantId,
      email: merchant.email,
    });
  } catch (error) {
    logger.error('[RecoveryAPI] Error starting campaign', error instanceof Error ? error : new Error(String(error)), { file: 'recovery/start-campaign/route.ts' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
