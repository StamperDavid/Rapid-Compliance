import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getLeads, createLead } from '@/lib/crm/lead-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const status = searchParams.get('status');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const filters = status && status !== 'all' ? { status } : undefined;
    const pagination = { pageSize };

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

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'default';
    const leadData = body.leadData;

    const result = await createLead(params.orgId, workspaceId, leadData);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create lead' },
      { status: 500 }
    );
  }
}
