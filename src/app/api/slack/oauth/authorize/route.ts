/**
 * Slack OAuth Authorization Endpoint
 * 
 * Initiates Slack OAuth flow for workspace connection.
 * 
 * Rate Limit: 10 req/min per IP
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createSlackService } from '@/lib/slack/slack-service';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import crypto from 'crypto';
import type { SlackOAuthState } from '@/lib/slack/types';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * GET /api/slack/oauth/authorize
 * 
 * Start Slack OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/oauth/authorize');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    // PENTHOUSE: Always use DEFAULT_ORG_ID
    const userId = searchParams.get('userId');
    const redirectUrl = searchParams.get('redirectUrl');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in Firestore (expires in 10 minutes)
    const oauthState: SlackOAuthState = {
      state,
      organizationId: DEFAULT_ORG_ID,
      userId,
      redirectUrl:(redirectUrl !== '' && redirectUrl != null) ? redirectUrl : `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations`,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    
    await db.collection('slack_oauth_states').doc(state).set(oauthState);
    
    // Get authorization URL
    const slackService = createSlackService();
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth/callback`;
    const authUrl = slackService.getAuthorizationUrl(state, callbackUrl);
    
    logger.info('Slack OAuth flow initiated', {
      DEFAULT_ORG_ID,
      userId,
      state,
    });
    
    // Redirect to Slack authorization page
    return NextResponse.redirect(authUrl);
    
  } catch (error: unknown) {
    logger.error('Failed to start Slack OAuth flow', error instanceof Error ? error : new Error(String(error)), {});

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to start Slack authorization',
      },
      { status: 500 }
    );
  }
}
