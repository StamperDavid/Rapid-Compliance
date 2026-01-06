/**
 * Activity Insights API
 * GET /api/crm/activities/insights - Get intelligent insights and next best action
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getActivityInsights, getNextBestAction } from '@/lib/crm/activity-service';
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
    const workspaceId: string = searchParams.get('workspaceId') || 'default';
    const entityType = searchParams.get('entityType') as any;
    const entityId = searchParams.get('entityId');

    if (!organizationId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'organizationId, entityType and entityId are required' },
        { status: 400 }
      );
    }

    const [insights, nextAction] = await Promise.all([
      getActivityInsights(organizationId, workspaceId, entityType, entityId),
      getNextBestAction(organizationId, workspaceId, entityType, entityId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        insights,
        nextBestAction: nextAction,
      },
    });

  } catch (error: any) {
    logger.error('Insights GET failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

