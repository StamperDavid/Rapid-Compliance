/**
 * Slack Settings Endpoint
 * 
 * Get and update Slack workspace settings.
 * 
 * Rate Limit: 30 req/min per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { updateWorkspaceSettingsSchema } from '@/lib/slack/validation';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SlackWorkspace } from '@/lib/slack/types';

/**
 * GET /api/slack/settings
 * 
 * Get workspace settings
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/settings');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspaceId parameter' },
        { status: 400 }
      );
    }
    
    // Get workspace
    const workspaceDoc = await db.collection('slack_workspaces').doc(workspaceId).get();
    
    if (!workspaceDoc.exists) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }
    
    const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as SlackWorkspace;
    
    logger.info('Retrieved Slack workspace settings', {
      workspaceId,
    });
    
    return NextResponse.json({
      workspace: {
        id: workspace.id,
        teamName: workspace.teamName,
        teamDomain: workspace.teamDomain,
        status: workspace.status,
        defaultChannelId: workspace.defaultChannelId,
        defaultChannelName: workspace.defaultChannelName,
        settings: workspace.settings,
        connectedAt: workspace.connectedAt.toDate().toISOString(),
        lastVerifiedAt: workspace.lastVerifiedAt?.toDate().toISOString(),
      },
    });
    
  } catch (error: any) {
    logger.error('Failed to get Slack settings', { error });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to get settings',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/slack/settings
 * 
 * Update workspace settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/settings');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Parse request body
    const body = await request.json();
    const workspaceId = body.workspaceId;
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspaceId' },
        { status: 400 }
      );
    }
    
    // Validate settings
    const validation = updateWorkspaceSettingsSchema.safeParse(body.settings);
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }
    
    const dal = new BaseAgentDAL(db);
    
    // Get workspace
    const workspaceDoc = await dal.safeGetDoc<SlackWorkspace>(
      dal.getColPath('slack_workspaces'),
      workspaceId
    );
    
    if (!workspaceDoc.exists()) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }
    
    const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as SlackWorkspace;
    
    // Update settings
    const updatedSettings = {
      ...workspace.settings,
      ...validation.data,
    };
    
    // Save updated workspace
    await db.collection('slack_workspaces').doc(workspaceId).update({
      settings: updatedSettings,
      updatedAt: Timestamp.now(),
    });
    
    logger.info('Updated Slack workspace settings', {
      workspaceId,
      updates: Object.keys(validation.data),
    });
    
    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
    
  } catch (error: any) {
    logger.error('Failed to update Slack settings', { error });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}
