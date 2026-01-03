/**
 * Slack OAuth Authorization Endpoint
 * 
 * Initiates Slack OAuth flow for workspace connection.
 * 
 * Rate Limit: 10 req/min per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createSlackService } from '@/lib/slack/slack-service';
import { Timestamp } from 'firebase-admin/firestore';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import crypto from 'crypto';
import type { SlackOAuthState } from '@/lib/slack/types';

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
    const orgId = searchParams.get('orgId');
    const userId = searchParams.get('userId');
    const redirectUrl = searchParams.get('redirectUrl');
    
    if (!orgId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: orgId, userId' },
        { status: 400 }
      );
    }
    
    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in Firestore (expires in 10 minutes)
    const dal = new BaseAgentDAL('production');
    const statesPath = dal.getColPath('slack_oauth_states');
    
    const oauthState: SlackOAuthState = {
      state,
      organizationId: orgId,
      userId,
      redirectUrl: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations`,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
    
    await dal.safeSetDoc(statesPath, state, oauthState);
    
    // Get authorization URL
    const slackService = createSlackService();
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth/callback`;
    const authUrl = slackService.getAuthorizationUrl(state, callbackUrl);
    
    logger.info('Slack OAuth flow initiated', {
      orgId,
      userId,
      state,
    });
    
    // Redirect to Slack authorization page
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    logger.error('Failed to start Slack OAuth flow', { error });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to start Slack authorization',
      },
      { status: 500 }
    );
  }
}
