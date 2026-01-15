/**
 * Activity Insights API
 * GET /api/crm/activities/insights - Get intelligent insights and next best action
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getActivityInsights, getNextBestAction } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { RelatedEntityType } from '@/types/activity';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = token.organizationId;
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId: string = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const entityTypeParam = searchParams.get('entityType');
    const validEntityTypes = ['lead', 'contact', 'company', 'deal', 'opportunity'];
    const entityType: RelatedEntityType | undefined = entityTypeParam && validEntityTypes.includes(entityTypeParam)
      ? entityTypeParam as RelatedEntityType
      : undefined;
    const entityId = searchParams.get('entityId');

    if (!organizationId || !entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'organizationId, entityType and entityId are required' },
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

  } catch (error) {
    logger.error('Insights GET failed', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

