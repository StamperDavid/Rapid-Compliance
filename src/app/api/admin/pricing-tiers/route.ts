import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

interface PricingTier {
  id: string;
  name: string;
  price: number;
}

interface PricingDoc {
  tiers?: PricingTier[];
}

interface TiersRequestBody {
  tiers: PricingTier[];
}

/**
 * GET: Retrieve current pricing tiers from Firestore
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin auth
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get pricing tiers from Firestore
    const pricingDoc = await FirestoreService.get<PricingDoc>('platform_config', 'pricing_tiers');

    if (pricingDoc?.tiers) {
      return NextResponse.json({ success: true, tiers: pricingDoc.tiers });
    }

    // Return empty if not found
    return NextResponse.json({ success: false, error: 'Pricing tiers not configured' }, { status: 404 });
  } catch (error: unknown) {
    logger.error('[Admin] Error fetching pricing tiers:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing tiers' },
      { status: 500 }
    );
  }
}

/**
 * POST: Update pricing tiers in Firestore
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as TiersRequestBody;
    const { tiers } = body;

    if (!tiers || !Array.isArray(tiers)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tiers data' },
        { status: 400 }
      );
    }

    // Validate tiers
    for (const tier of tiers) {
      if (!tier.id || !tier.name || typeof tier.price !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Invalid tier configuration' },
          { status: 400 }
        );
      }
    }

    // Save to Firestore
    await FirestoreService.set('platform_config', 'pricing_tiers', {
      tiers,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    });

    logger.info('[Admin] Pricing tiers updated', {
      userId: user.uid,
      tierCount: tiers.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Pricing tiers updated successfully'
    });
  } catch (error: unknown) {
    logger.error('[Admin] Error updating pricing tiers:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update pricing tiers' },
      { status: 500 }
    );
  }
}

