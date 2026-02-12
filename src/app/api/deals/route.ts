import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeals, createDeal, deleteDeal } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

const querySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  stage: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(100),
});

const createDealSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  value: z.number().min(0, 'Value must be non-negative'),
  company: z.string().optional(),
  companyName: z.string().optional(),
  contactId: z.string().optional(),
  currency: z.string().optional().default('USD'),
  stage: z.enum(DEAL_STAGES).optional().default('prospecting'),
  probability: z.number().min(0).max(100).optional().default(10),
  expectedCloseDate: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  workspaceId: z.string().optional().default('default'),
});

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  workspaceId: z.string().optional().default('default'),
});

export async function GET(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
      stage: searchParams.get('stage') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { workspaceId, stage, pageSize } = queryResult.data;
    const filters = stage && stage !== 'all' ? { stage } : undefined;
    const pagination = { pageSize };

    const result = await getDeals(workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deals';
    logger.error('Failed to fetch deals:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createDealSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { workspaceId, expectedCloseDate, ...dealData } = bodyResult.data;
    const deal = await createDeal({
      ...dealData,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    }, workspaceId);

    return NextResponse.json({ success: true, deal }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create deal';
    logger.error('Failed to create deal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = deleteBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { ids, workspaceId } = bodyResult.data;
    const results = await Promise.allSettled(
      ids.map(id => deleteDeal(id, workspaceId))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error(`Failed to delete ${failed.length}/${ids.length} deals`);
    }

    return NextResponse.json({
      deleted: ids.length - failed.length,
      failed: failed.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete deals';
    logger.error('Failed to delete deals:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
