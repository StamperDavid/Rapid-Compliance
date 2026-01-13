/**
 * Recovery Campaign API
 *
 * Triggers multi-channel recovery siege when a lead abandons.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { merchantId } = await request.json();

    if (!merchantId) {
      return NextResponse.json(
        { error: 'merchantId required' },
        { status: 400 }
      );
    }

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
    await engine.startRecoveryCampaign(merchant);

    return NextResponse.json({
      success: true,
      message: 'Recovery campaign started',
      merchantId,
      email: merchant.email,
    });
  } catch (error) {
    console.error('[RecoveryAPI] Error starting campaign:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
