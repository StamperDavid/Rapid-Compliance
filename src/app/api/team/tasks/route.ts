/**
 * Team Tasks API
 * GET /api/team/tasks - Get tasks
 * POST /api/team/tasks - Create task
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTask, getUserTasks } from '@/lib/team/collaboration';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

// Task status type with type guard
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';
const VALID_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'completed'] as const;

function isValidStatus(value: string): value is TaskStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

// Zod schema for task creation
const CreateTaskSchema = z.object({
  workspaceId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedTo: z.string().min(1, 'Assigned to is required'),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  relatedEntityType: z.enum(['deal', 'lead', 'contact']).optional(),
  relatedEntityId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const userIdParam = searchParams.get('userId');
    const userId = (userIdParam !== '' && userIdParam != null) ? userIdParam : token.uid;
    const statusParam = searchParams.get('status');
    const status: TaskStatus | undefined = statusParam && isValidStatus(statusParam) ? statusParam : undefined;

    const tasks = await getUserTasks(workspaceId, userId, status);

    return NextResponse.json({
      success: true,
      data: tasks,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tasks GET API failed', error instanceof Error ? error : new Error(String(error)), {});
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

    const body: unknown = await request.json();
    const parseResult = CreateTaskSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message ?? 'Invalid request';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const validatedData = parseResult.data;

    const workspaceId = validatedData.workspaceId ?? 'default';
    const assignedByName = token.email ?? undefined;

    const task = await createTask(workspaceId, {
      title: validatedData.title,
      description: validatedData.description,
      assignedTo: validatedData.assignedTo,
      assignedToName: validatedData.assignedToName,
      assignedBy: token.uid,
      assignedByName,
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
      priority: validatedData.priority,
      status: 'todo',
      relatedEntityType: validatedData.relatedEntityType,
      relatedEntityId: validatedData.relatedEntityId,
      tags: validatedData.tags,
    });

    return NextResponse.json({
      success: true,
      data: task,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Task POST API failed', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

