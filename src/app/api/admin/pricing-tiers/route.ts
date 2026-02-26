import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * Zod schema for pricing tier validation.
 * Rejects negative prices, NaN, and Infinity.
 */
const pricingTierSchema = z.object({
  id: z.string().min(1, 'Tier ID is required'),
  name: z.string().min(1, 'Tier name is required'),
  price: z.number()
    .nonnegative('Price must be non-negative')
    .finite('Price must be a finite number'),
});

const tiersRequestSchema = z.object({
  tiers: z.array(pricingTierSchema).min(1, 'At least one tier is required'),
});

interface PricingDoc {
  tiers?: z.infer<typeof pricingTierSchema>[];
}

/**
 * GET: Retrieve current pricing tiers from Firestore
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get pricing tiers from Firestore
    const pricingDocRaw = await AdminFirestoreService.get('platform_config', 'pricing_tiers');
    const pricingDoc = pricingDocRaw as PricingDoc | null;

    if (pricingDoc?.tiers) {
      return NextResponse.json({ success: true, tiers: pricingDoc.tiers });
    }

    // Return empty if not found
    return NextResponse.json({ success: false, error: 'Pricing tiers not configured' }, { status: 404 });
  } catch (error: unknown) {
    logger.error('[Admin] Error fetching pricing tiers', error instanceof Error ? error : new Error(String(error)));
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
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    const body: unknown = await request.json();
    const validationResult = tiersRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');

      logger.warn('[Admin] Invalid pricing tiers data', {
        userId: user.uid,
        errors: errorMessage,
      });

      return NextResponse.json(
        { success: false, error: `Validation failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    const { tiers } = validationResult.data;

    // Save to Firestore
    await AdminFirestoreService.set('platform_config', 'pricing_tiers', {
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
    logger.error('[Admin] Error updating pricing tiers', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update pricing tiers' },
      { status: 500 }
    );
  }
}

