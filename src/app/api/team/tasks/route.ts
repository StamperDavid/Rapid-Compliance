/**
 * Team Tasks API
 * GET /api/team/tasks - Get tasks
 * POST /api/team/tasks - Create task
 */

import { NextRequest, NextResponse } from 'next/server';
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
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const userId = searchParams.get('userId') || token.uid;
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
    const workspaceId = body.workspaceId || 'default';

    const task = await createTask(organizationId, workspaceId, {
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      assignedToName: body.assignedToName,
      assignedBy: token.uid,
      assignedByName: token.email,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority: body.priority || 'normal',
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

