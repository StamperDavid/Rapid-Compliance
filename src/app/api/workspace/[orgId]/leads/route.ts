import { NextRequest, NextResponse } from 'next/server';
import { getLeads } from '@/lib/crm/lead-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const status = searchParams.get('status');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const lastDocId = searchParams.get('lastDoc');

    const filters = status && status !== 'all' ? { status } : undefined;
    const pagination = { pageSize, lastDoc: lastDocId };

    const result = await getLeads(params.orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
