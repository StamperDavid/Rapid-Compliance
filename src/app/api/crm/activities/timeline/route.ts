/**
 * Activity Timeline API
 * GET /api/crm/activities/timeline - Get timeline for an entity
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getEntityTimeline } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = token.organizationId;
    const workspaceId =(searchParams.get('workspaceId') !== '' && searchParams.get('workspaceId') != null) ? searchParams.get('workspaceId') : 'default';
    const entityType = searchParams.get('entityType') as any;
    const entityId = searchParams.get('entityId');

    if (!organizationId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'organizationId, entityType and entityId are required' },
        { status: 400 }
      );
    }

    const timeline = await getEntityTimeline(
      organizationId,
      workspaceId,
      entityType,
      entityId
    );

    return NextResponse.json({
      success: true,
      data: timeline,
    });

  } catch (error: any) {
    logger.error('Timeline GET failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

