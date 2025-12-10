/**
 * Google OAuth - Start authentication flow
 * GET /api/integrations/google/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/integrations/google-calendar-service';

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

  // Store state for callback
  const state = Buffer.from(JSON.stringify({ userId, orgId })).toString('base64');

  // Get Google OAuth URL
  const authUrl = getAuthUrl() + `&state=${state}`;

  return NextResponse.redirect(authUrl);
}











