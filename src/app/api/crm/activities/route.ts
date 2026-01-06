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

    const workspaceId = searchParams.get('workspaceId') || 'default';
    
    // Parse filters
    const entityType = searchParams.get('entityType') as any;
    const entityId = searchParams.get('entityId');
    const typesParam = searchParams.get('types');
    const types = typesParam ? typesParam.split(',') as any[] : undefined;
    const direction = searchParams.get('direction') as any;
    const createdBy = searchParams.get('createdBy') || undefined;
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const filters = {
      entityType,
      entityId: entityId || undefined,
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

  } catch (error: any) {
    logger.error('Activities GET failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
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

    const workspaceId = body.workspaceId || 'default';

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

  } catch (error: any) {
    logger.error('Activity POST failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

