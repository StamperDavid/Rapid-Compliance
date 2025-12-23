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

  // Get Google OAuth URL with Gmail AND Calendar scopes
  const { google } = await import('googleapis');
  const { OAuth2Client } = await import('google-auth-library');
  
  // Use current domain for redirect (works in dev, preview, and production)
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/integrations/google/callback`;
  
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(authUrl);
}



















