import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeal, updateDeal, deleteDeal } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

const updateDealSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.number().min(0).optional(),
  company: z.string().optional(),
  companyName: z.string().optional(),
  contactId: z.string().optional(),
  currency: z.string().optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/deals/[dealId] - Get a single deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const deal = await getDeal(dealId);
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deal';
    logger.error('Failed to fetch deal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/deals/[dealId] - Update a deal
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateDealSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { expectedCloseDate, ...updates } = bodyResult.data;
    const deal = await updateDeal(dealId, {
      ...updates,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    });

    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update deal';
    logger.error('Failed to update deal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deals/[dealId] - Delete a deal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await deleteDeal(dealId);

    return NextResponse.json({ success: true, deleted: dealId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete deal';
    logger.error('Failed to delete deal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
