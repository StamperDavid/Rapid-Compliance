import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksAuthUrl } from '@/lib/integrations/quickbooks-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const orgId = searchParams.get('orgId');

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: 'Missing userId or orgId' },
      { status: 400 }
    );
  }

  const authUrl = getQuickBooksAuthUrl();
  return NextResponse.redirect(authUrl);
}














