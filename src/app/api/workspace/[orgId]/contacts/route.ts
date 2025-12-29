import { NextRequest, NextResponse } from 'next/server';
import { getContacts } from '@/lib/crm/contact-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const type = searchParams.get('type');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const lastDocId = searchParams.get('lastDoc');

    const filters = type && type !== 'all' ? { type } : undefined;
    const pagination = { pageSize, lastDoc: lastDocId };

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
