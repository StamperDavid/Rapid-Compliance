import { type NextRequest, NextResponse } from 'next/server';
import { getContacts } from '@/lib/crm/contact-service';
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
    const company = searchParams.get('company');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt((pageSizeParam !== '' && pageSizeParam != null) ? pageSizeParam : '50');

    const filters = company ? { company } : undefined;
    const pagination = { pageSize };

    const result = await getContacts(orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch contacts';
    logger.error('Failed to fetch contacts:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
