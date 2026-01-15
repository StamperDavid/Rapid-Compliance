/**
 * Activity Timeline API
 * GET /api/crm/activities/timeline - Get timeline for an entity
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getEntityTimeline } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { RelatedEntityType } from '@/types/activity';

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

    const entityTypeParam = searchParams.get('entityType');
    const entityType: RelatedEntityType | undefined =
      entityTypeParam && ['lead', 'contact', 'company', 'deal', 'opportunity'].includes(entityTypeParam)
        ? entityTypeParam as RelatedEntityType
        : undefined;
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

  } catch (error) {
    logger.error('Timeline GET failed', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

