import { type NextRequest, NextResponse } from 'next/server';
import { getDeals } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const stage = searchParams.get('stage');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt((pageSizeParam !== '' && pageSizeParam != null) ? pageSizeParam : '100');

    const filters = stage && stage !== 'all' ? { stage } : undefined;
    const pagination = { pageSize };

    const result = await getDeals(orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deals';
    logger.error('Failed to fetch deals:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
