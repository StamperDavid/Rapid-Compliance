import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getContacts } from '@/lib/crm/contact-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const company = searchParams.get('company');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt((pageSizeParam !== '' && pageSizeParam != null) ? pageSizeParam : '50');

    const filters = company ? { company } : undefined;
    const pagination = { pageSize };

    const result = await getContacts(params.orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json(
      { error:(error.message !== '' && error.message != null) ? error.message : 'Failed to fetch contacts'},
      { status: 500 }
    );
  }
}
