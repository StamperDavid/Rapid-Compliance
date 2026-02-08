/**
 * Slack Send Message Endpoint
 * 
 * Sends a message to a Slack channel.
 * 
 * Rate Limit: 50 req/min per workspace
 * Cache: No caching (real-time sending)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { createSlackService } from '@/lib/slack/slack-service';
import { sendSlackMessageSchema } from '@/lib/slack/validation';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SlackWorkspace, SlackMessage } from '@/lib/slack/types';

/**
 * POST /api/slack/send
 * 
 * Send Slack message
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/send');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Parse request body
    const body: unknown = await request.json();

    // Validate input
    const validation = sendSlackMessageSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
    // Get workspace
    const workspaceDoc = await db.collection('slack_workspaces').doc(data.workspaceId).get();
    
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
    
    // Check if enabled
    if (!workspace.settings.enabled) {
      return NextResponse.json(
        { error: 'Slack notifications disabled for this workspace' },
        { status: 400 }
      );
    }
    
    // Create message record
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const message: Partial<SlackMessage> = {
      id: messageId,
      workspaceId: workspace.id,
      channelId: data.channelId,
      type: data.type,
      priority: data.priority,
      category: data.category,
      text: data.text,
      blocks: data.blocks as SlackMessage['blocks'],
      attachments: data.attachments as SlackMessage['attachments'],
      threadTs: data.threadTs,
      userId: data.userId,
      mentions: data.mentions,
      metadata: data.metadata,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    // Send message
    const slackService = createSlackService();
    
    try {
      const result = await slackService.sendMessage(workspace, message);
      
      // Update message with results
      message.status = 'sent';
      message.slackTs = result.ts;
      message.permalink = result.permalink;
      message.sentAt = Timestamp.now();
      
      // Save message record
      await db
        .collection('organizations')
        .doc(PLATFORM_ID)
        .collection('slack_messages')
        .doc(messageId)
        .set(message);
      
      logger.info('Slack message sent successfully', {
        messageId,
        workspaceId: workspace.id,
        channelId: data.channelId,
        ts: result.ts,
      });
      
      return NextResponse.json({
        success: true,
        messageId,
        ts: result.ts,
        channel: result.channel,
        permalink: result.permalink,
      });
      
    } catch (sendError: unknown) {
      const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
      logger.error('Failed to send Slack message', sendError instanceof Error ? sendError : new Error(String(sendError)), {
        messageId,
        workspaceId: workspace.id,
      });

      // Update message status
      message.status = 'failed';
      message.error = errorMessage;

      // Save failed message
      await db
        .collection('organizations')
        .doc(PLATFORM_ID)
        .collection('slack_messages')
        .doc(messageId)
        .set(message);

      return NextResponse.json(
        {
          error: 'Failed to send message',
          message: errorMessage,
        },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    logger.error('Failed to process send message request', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
