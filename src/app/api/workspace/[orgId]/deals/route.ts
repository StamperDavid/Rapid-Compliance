import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getDeals } from '@/lib/crm/deal-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const stage = searchParams.get('stage');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt((pageSizeParam !== '' && pageSizeParam != null) ? pageSizeParam : '100');

    const filters = stage && stage !== 'all' ? { stage } : undefined;
    const pagination = { pageSize };

    const result = await getDeals(params.orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to fetch deals:', error);
    return NextResponse.json(
      { error:(error.message !== '' && error.message != null) ? error.message : 'Failed to fetch deals'},
      { status: 500 }
    );
  }
}
