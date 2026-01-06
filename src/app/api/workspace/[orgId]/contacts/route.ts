import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getContacts } from '@/lib/crm/contact-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const company = searchParams.get('company');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const filters = company ? { company } : undefined;
    const pagination = { pageSize };

    const result = await getContacts(params.orgId, workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}
