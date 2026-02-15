/**
 * API Route: Individual Team Task Operations
 *
 * PUT    /api/team/tasks/[taskId] - Update task
 * DELETE /api/team/tasks/[taskId] - Delete task
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function getTasksPath(): string {
  return `${getSubCollection('workspaces')}/default/tasks`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { taskId } = await params;

    const body: unknown = await request.json();
    const validation = updateTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      ...validation.data,
      updatedAt: new Date(),
    };

    // If setting dueDate from string, convert to Date
    if (validation.data.dueDate) {
      updates.dueDate = new Date(validation.data.dueDate);
    }

    // If completing, set completedAt
    if (validation.data.status === 'completed') {
      updates.completedAt = new Date();
    }

    const tasksPath = getTasksPath();
    await FirestoreService.update(tasksPath, taskId, updates);

    logger.info('Task updated', { taskId, fields: Object.keys(validation.data) });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Task PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { taskId } = await params;
    const tasksPath = getTasksPath();

    await FirestoreService.delete(tasksPath, taskId);

    logger.info('Task deleted', { taskId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Task DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
