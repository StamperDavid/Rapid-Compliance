import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksAuthUrl } from '@/lib/integrations/quickbooks-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/quickbooks/auth');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

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



















