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
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  console.log('[Google Auth] Environment check:');
  console.log('  GOOGLE_CLIENT_ID:', clientId ? `SET (${clientId.substring(0, 20)}...)` : 'MISSING');
  console.log('  GOOGLE_CLIENT_SECRET:', clientSecret ? 'SET' : 'MISSING');
  
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. Check environment variables.' },
      { status: 500 }
    );
  }
  
  // Use current domain for redirect (works in dev, preview, and production)
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/integrations/google/callback`;
  
  console.log('  Redirect URI:', redirectUri);
  
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
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



















