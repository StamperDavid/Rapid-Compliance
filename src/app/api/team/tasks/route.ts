/**
 * Team Tasks API
 * GET /api/team/tasks - Get tasks
 * POST /api/team/tasks - Create task
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { createTask, getUserTasks, completeTask } from '@/lib/team/collaboration';
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

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const userIdParam = searchParams.get('userId');
    const userId = (userIdParam !== '' && userIdParam != null) ? userIdParam : token.uid;
    const status = searchParams.get('status') as any;

    const tasks = await getUserTasks(organizationId, workspaceId, userId, status);

    return NextResponse.json({
      success: true,
      data: tasks,
    });

  } catch (error: any) {
    logger.error('Tasks GET API failed', error);
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

    const workspaceId = (body.workspaceId !== '' && body.workspaceId != null) ? body.workspaceId : 'default';
    const assignedByName = (token.email !== '' && token.email != null) ? token.email : undefined;
    const priorityVal = body.priority;
    const priority = (priorityVal !== '' && priorityVal != null) ? priorityVal : 'normal';

    const task = await createTask(organizationId, workspaceId, {
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      assignedToName: body.assignedToName,
      assignedBy: token.uid,
      assignedByName,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority,
      status: 'todo',
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      tags: body.tags,
    });

    return NextResponse.json({
      success: true,
      data: task,
    });

  } catch (error: any) {
    logger.error('Task POST API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

