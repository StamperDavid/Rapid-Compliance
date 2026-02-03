import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeals } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';

const querySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  stage: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(100),
});

export async function GET(
  request: NextRequest
) {
  try {
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
