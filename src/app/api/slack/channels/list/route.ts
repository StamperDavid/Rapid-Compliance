/**
 * Slack Channels List Endpoint
 * 
 * Lists available Slack channels for a workspace.
 * 
 * Rate Limit: 30 req/min per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createSlackService } from '@/lib/slack/slack-service';
import { listChannelsSchema } from '@/lib/slack/validation';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SlackWorkspace, SlackChannel } from '@/lib/slack/types';

/**
 * GET /api/slack/channels/list
 * 
 * List Slack channels
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/channels/list');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const types = searchParams.get('types')?.split(',');
    const excludeArchived = searchParams.get('excludeArchived') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const cursor = searchParams.get('cursor') || undefined;
    
    // Validate input
    const validation = listChannelsSchema.safeParse({
      workspaceId,
      types,
      excludeArchived,
      limit,
      cursor,
    });
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }
    
    // Get workspace
    const workspaceDoc = await db.collection('slack_workspaces').doc(workspaceId!).get();
    
    if (!workspaceDoc.exists) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }
    
    const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as SlackWorkspace;
    
    // Check workspace status
    if (workspace.status !== 'connected') {
      return NextResponse.json(
        { error: 'Workspace not connected' },
        { status: 400 }
      );
    }
    
    // List channels from Slack
    const slackService = createSlackService();
    const result = await slackService.listChannels(
      workspace.botToken,
      {
        types: validation.data.types,
        excludeArchived: validation.data.excludeArchived,
        limit: validation.data.limit,
        cursor: validation.data.cursor,
      }
    );
    
    // Cache channels in Firestore
    const channelsCollection = db
      .collection('organizations')
      .doc(workspace.organizationId)
      .collection('slack_channels');
    
    const cachePromises = result.channels.map(async (channel) => {
      const slackChannel: SlackChannel = {
        id: channel.id,
        workspaceId: workspace.id,
        organizationId: workspace.organizationId,
        name: channel.name,
        type: channel.type,
        isArchived: channel.isArchived,
        isMember: channel.isMember,
        topic: channel.topic,
        purpose: channel.purpose,
        memberCount: channel.memberCount,
        createdInSlack: channel.created,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      await channelsCollection.doc(channel.id).set(slackChannel);
    });
    
    await Promise.all(cachePromises);
    
    logger.info('Listed Slack channels', {
      workspaceId,
      count: result.channels.length,
      hasMore: !!result.nextCursor,
    });
    
    return NextResponse.json({
      channels: result.channels,
      nextCursor: result.nextCursor,
    });
    
  } catch (error: any) {
    logger.error('Failed to list Slack channels', { error });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to list channels',
      },
      { status: 500 }
    );
  }
}
