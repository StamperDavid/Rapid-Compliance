import { NextRequest, NextResponse } from 'next/server';
import { getDeals } from '@/lib/crm/deal-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const stage = searchParams.get('stage');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const lastDocId = searchParams.get('lastDoc');

    const filters = stage && stage !== 'all' ? { stage } : undefined;
    const pagination = { pageSize, lastDoc: lastDocId };

    const result = await getDeals(params.orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to fetch deals:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}
