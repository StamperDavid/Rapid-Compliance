/**
 * Activity Stats API
 * GET /api/crm/activities/stats - Get activity statistics
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getActivityStats } from '@/lib/crm/activity-service';
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
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const entityType = searchParams.get('entityType') as any;
    const entityId = searchParams.get('entityId');

    if (!organizationId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'organizationId, entityType and entityId are required' },
        { status: 400 }
      );
    }

    const stats = await getActivityStats(
      organizationId,
      workspaceId,
      entityType,
      entityId
    );

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error: any) {
    logger.error('Stats GET failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

