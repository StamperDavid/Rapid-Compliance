/**
 * Slack OAuth Callback Endpoint
 * 
 * Handles OAuth callback from Slack after user authorizes app.
 * Exchanges code for access token and stores workspace credentials.
 * 
 * Rate Limit: 10 req/min per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createSlackService } from '@/lib/slack/slack-service';
import { oauthCallbackSchema } from '@/lib/slack/validation';
import { Timestamp } from 'firebase-admin/firestore';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import { db } from '@/lib/firebase-admin';
import type { SlackWorkspace, SlackOAuthState } from '@/lib/slack/types';

/**
 * GET /api/slack/oauth/callback
 * 
 * Handle Slack OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/oauth/callback');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      logger.warn('Slack OAuth error', { error });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=slack_${error}`
      );
    }
    
    // Validate input
    const validation = oauthCallbackSchema.safeParse({ code, state });
    
    if (!validation.success) {
      logger.error('Invalid OAuth callback parameters', {
        errors: validation.error.errors,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_callback`
      );
    }
    
    const dal = new BaseAgentDAL(db);
    
    // Verify state token
    const statesPath = dal.getColPath('slack_oauth_states');
    const stateDoc = await dal.safeGetDoc<SlackOAuthState>(statesPath, state!);
    
    if (!stateDoc.exists()) {
      logger.error('Invalid or expired OAuth state', { state });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      );
    }
    
    const oauthState = stateDoc.data() as SlackOAuthState;
    
    // Check expiration
    if (oauthState.expiresAt.toMillis() < Date.now()) {
      logger.error('OAuth state expired', { state });
      await dal.safeDeleteDoc(statesPath, state!);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=state_expired`
      );
    }
    
    // Exchange code for tokens
    const slackService = createSlackService();
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth/callback`;
    
    const tokenResponse = await slackService.exchangeOAuthCode(code!, callbackUrl);
    
    // Test authentication to verify token
    await slackService.testAuth(tokenResponse.access_token);
    
    // Create workspace record
    const workspaceId = `slack_${tokenResponse.team.id}`;
    const workspacesPath = `${dal.getColPath('organizations')}/${oauthState.organizationId}/${dal.getSubColPath('slack_workspaces')}`;
    
    const workspace: SlackWorkspace = {
      id: workspaceId,
      organizationId: oauthState.organizationId,
      teamId: tokenResponse.team.id,
      teamName: tokenResponse.team.name,
      teamDomain: tokenResponse.team.id, // Slack v2 doesn't always include domain
      botToken: tokenResponse.access_token,
      botUserId: tokenResponse.bot_user_id || '',
      scopes: tokenResponse.scope.split(','),
      installedBy: {
        userId: oauthState.userId,
      },
      incomingWebhookUrl: tokenResponse.incoming_webhook?.url,
      defaultChannelId: tokenResponse.incoming_webhook?.channel_id,
      defaultChannelName: tokenResponse.incoming_webhook?.channel,
      status: 'connected',
      connectedAt: Timestamp.now(),
      lastVerifiedAt: Timestamp.now(),
      settings: {
        enabled: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'America/New_York',
        },
        rateLimit: {
          maxMessagesPerMinute: 60,
          maxMessagesPerHour: 3000,
        },
        batching: {
          enabled: false,
          intervalMinutes: 15,
          maxBatchSize: 10,
        },
        threading: {
          enabled: true,
          timeoutHours: 24,
        },
        mentions: {
          allowChannelMentions: true,
          allowHereMentions: true,
        },
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await dal.safeSetDoc(workspacesPath, workspaceId, workspace);
    
    // Delete state token
    await dal.safeDeleteDoc(statesPath, state!);
    
    logger.info('Slack workspace connected successfully', {
      workspaceId,
      orgId: oauthState.organizationId,
      teamId: tokenResponse.team.id,
      teamName: tokenResponse.team.name,
    });
    
    // Redirect to success page
    const redirectUrl = oauthState.redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations`;
    return NextResponse.redirect(`${redirectUrl}?success=slack_connected`);
    
  } catch (error) {
    logger.error('Failed to handle Slack OAuth callback', { error });
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=oauth_failed`
    );
  }
}
