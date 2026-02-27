/**
 * Slack Channel Mappings Endpoint
 *
 * Manage channel mappings for notification categories.
 *
 * Rate Limit: 30 req/min per user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  createChannelMappingSchema,
  updateChannelMappingSchema,
} from '@/lib/slack/validation';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SlackChannelMapping, SlackWorkspace } from '@/lib/slack/types';
import { getSlackWorkspacesCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// Type-safe interfaces for request bodies
interface CreateMappingRequestBody {
  workspaceId: string;
  category: string;
  channelId: string;
  channelName: string;
  minPriority?: string;
  enabled?: boolean;
  userId?: string;
}

interface UpdateMappingRequestBody {
  mappingId: string;
  updates: {
    channelId?: string;
    channelName?: string;
    minPriority?: string;
    enabled?: boolean;
  };
}

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Extract error message safely
function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * GET /api/slack/mappings
 * 
 * List channel mappings for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/mappings');
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
    
    // Get workspace to verify it exists
    const workspaceDoc = await db.collection(getSlackWorkspacesCollection()).doc(workspaceId).get();

    if (!workspaceDoc.exists) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const _workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as SlackWorkspace;

    // Get mappings
    const snapshot = await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('slack_channel_mappings')
      .get();
    
    const mappings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SlackChannelMapping[];
    
    logger.info('Listed Slack channel mappings', {
      workspaceId,
      count: mappings.length,
    });
    
    return NextResponse.json({
      mappings,
    });
    
  } catch (error: unknown) {
    logger.error('Failed to list Slack mappings', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: getErrorMessage(error) || 'Failed to list mappings',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/slack/mappings
 * 
 * Create a new channel mapping
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/mappings');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse request body
    const body = (await request.json()) as CreateMappingRequestBody;

    // Validate input
    const validation = createChannelMappingSchema.safeParse(body);
    
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
    const workspaceDoc = await db.collection(getSlackWorkspacesCollection()).doc(data.workspaceId).get();

    if (!workspaceDoc.exists) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const _workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as SlackWorkspace;

    // Check for existing mapping
    const existingSnapshot = await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('slack_channel_mappings')
      .where('category', '==', data.category)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: 'Mapping already exists for this category' },
        { status: 409 }
      );
    }
    
    // Create mapping
    const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const mapping: SlackChannelMapping = {
      id: mappingId,
      workspaceId: data.workspaceId,
      category: data.category,
      channelId: data.channelId,
      channelName: data.channelName,
      minPriority: data.minPriority,
      enabled: data.enabled,
      createdBy: body.userId && body.userId !== '' ? body.userId : 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('slack_channel_mappings')
      .doc(mappingId)
      .set(mapping);
    
    logger.info('Created Slack channel mapping', {
      mappingId,
      workspaceId: data.workspaceId,
      category: data.category,
      channelId: data.channelId,
    });
    
    return NextResponse.json({
      success: true,
      mapping,
    }, { status: 201 });

  } catch (error: unknown) {
    logger.error('Failed to create Slack mapping', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: getErrorMessage(error) || 'Failed to create mapping',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/slack/mappings
 * 
 * Update an existing channel mapping
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/mappings');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse request body
    const body = (await request.json()) as UpdateMappingRequestBody;
    const mappingId = body.mappingId;

    if (!mappingId) {
      return NextResponse.json(
        { error: 'Missing mappingId' },
        { status: 400 }
      );
    }

    // Validate updates
    const validation = updateChannelMappingSchema.safeParse(body.updates);
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }
    
    // Find mapping (we need to search since we don't know the org ID)
    const orgsSnapshot = await db.collection('organizations').get();
    
    let found = false;
    let mappingsPath = '';
    
    for (const orgDoc of orgsSnapshot.docs) {
      const mappingDoc = await db
        .collection('organizations')
        .doc(orgDoc.id)
        .collection('slack_channel_mappings')
        .doc(mappingId)
        .get();
      
      if (mappingDoc.exists) {
        mappingsPath = `organizations/${orgDoc.id}/slack_channel_mappings`;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    // Update mapping
    await db.doc(`${mappingsPath}/${mappingId}`).update({
      ...validation.data,
      updatedAt: Timestamp.now(),
    });
    
    logger.info('Updated Slack channel mapping', {
      mappingId,
      updates: Object.keys(validation.data),
    });

    return NextResponse.json({
      success: true,
    });

  } catch (error: unknown) {
    logger.error('Failed to update Slack mapping', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: getErrorMessage(error) || 'Failed to update mapping',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/slack/mappings
 * 
 * Delete a channel mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/slack/mappings');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get parameters
    const searchParams = request.nextUrl.searchParams;
    const mappingId = searchParams.get('mappingId');
    
    if (!mappingId) {
      return NextResponse.json(
        { error: 'Missing mappingId parameter' },
        { status: 400 }
      );
    }
    
    // Find mapping
    const orgsSnapshot = await db.collection('organizations').get();
    
    let found = false;
    let mappingsPath = '';
    
    for (const orgDoc of orgsSnapshot.docs) {
      const mappingDoc = await db
        .collection('organizations')
        .doc(orgDoc.id)
        .collection('slack_channel_mappings')
        .doc(mappingId)
        .get();
      
      if (mappingDoc.exists) {
        mappingsPath = `organizations/${orgDoc.id}/slack_channel_mappings`;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    // Delete mapping
    await db.doc(`${mappingsPath}/${mappingId}`).delete();
    
    logger.info('Deleted Slack channel mapping', {
      mappingId,
    });

    return NextResponse.json({
      success: true,
    });

  } catch (error: unknown) {
    logger.error('Failed to delete Slack mapping', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: getErrorMessage(error) || 'Failed to delete mapping',
      },
      { status: 500 }
    );
  }
}
