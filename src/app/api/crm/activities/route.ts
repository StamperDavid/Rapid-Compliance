/**
 * Activities API Routes
 * GET /api/crm/activities - List activities with filters
 * POST /api/crm/activities - Create activity
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getActivities, createActivity } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { RelatedEntityType, ActivityType, ActivityDirection } from '@/types/activity';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';

    // Parse filters with proper type guards
    const entityTypeParam = searchParams.get('entityType');
    const entityType: RelatedEntityType | undefined =
      entityTypeParam && ['lead', 'contact', 'company', 'deal', 'opportunity'].includes(entityTypeParam)
        ? entityTypeParam as RelatedEntityType
        : undefined;

    const entityId = searchParams.get('entityId');

    const typesParam = searchParams.get('types');
    const validActivityTypes: ActivityType[] = [
      'email_sent', 'email_received', 'email_opened', 'email_clicked',
      'call_made', 'call_received', 'meeting_scheduled', 'meeting_completed',
      'meeting_no_show', 'ai_chat', 'note_added', 'task_created', 'task_completed',
      'form_submitted', 'website_visit', 'document_viewed', 'deal_stage_changed',
      'lead_status_changed', 'field_updated', 'enrichment_completed',
      'sequence_enrolled', 'sequence_unenrolled', 'workflow_triggered',
      'sms_sent', 'sms_received'
    ];
    const types: ActivityType[] | undefined = typesParam
      ? typesParam.split(',').filter((t): t is ActivityType => validActivityTypes.includes(t as ActivityType))
      : undefined;

    const directionParam = searchParams.get('direction');
    const direction: ActivityDirection | undefined =
      directionParam && ['inbound', 'outbound', 'internal'].includes(directionParam)
        ? directionParam as ActivityDirection
        : undefined;

    const createdByParam = searchParams.get('createdBy');
    const createdBy = (createdByParam !== '' && createdByParam != null) ? createdByParam : undefined;
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt((pageSizeParam !== '' && pageSizeParam != null) ? pageSizeParam : '50');

    const filters = {
      entityType,
      entityId: entityId ?? undefined,
      types,
      direction,
      createdBy,
    };

    const result = await getActivities(
      organizationId,
      workspaceId,
      filters,
      { pageSize }
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });

  } catch (error) {
    logger.error('Activities GET failed', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const workspaceId = (body.workspaceId !== '' && body.workspaceId != null) ? body.workspaceId : 'default';

    // Add user attribution if not provided
    if (!body.createdBy) {
      body.createdBy = token.uid;
      body.createdByName = token.email;
    }

    const activity = await createActivity(organizationId, workspaceId, body);

    return NextResponse.json({
      success: true,
      data: activity,
    });

  } catch (error) {
    logger.error('Activity POST failed', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

