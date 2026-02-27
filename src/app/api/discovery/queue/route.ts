/**
 * API Route: Queue Discovery Tasks
 *
 * Endpoint to add new tasks to the discovery queue.
 *
 * POST /api/discovery/queue
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { queueDiscoveryTask } from '@/lib/services/discovery-dispatcher';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const DiscoveryTaskSchema = z.object({
  type: z.enum(['company', 'person']),
  target: z.string(),
  priority: z.number().optional(),
});

const BatchDiscoveryTasksSchema = z.object({
  tasks: z.array(DiscoveryTaskSchema),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = DiscoveryTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Queue the task
    const taskId = await queueDiscoveryTask(
      parsed.data.type,
      parsed.data.target,
      parsed.data.priority ?? 0
    );

    logger.info('[API] Discovery task queued', {
      taskId,
      type: parsed.data.type,
      target: parsed.data.target,
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: `Discovery task queued for ${parsed.data.type}: ${parsed.data.target}`,
    });
  } catch (error: unknown) {
    logger.error('[API] Failed to queue discovery task', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Batch queue multiple tasks
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = BatchDiscoveryTasksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      parsed.data.tasks.map((task) =>
        queueDiscoveryTask(
          task.type,
          task.target,
          task.priority ?? 0
        )
      )
    );

    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled'
    );
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    logger.info('[API] Batch discovery tasks queued', {
      total: parsed.data.tasks.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return NextResponse.json({
      success: true,
      stats: {
        total: parsed.data.tasks.length,
        succeeded: succeeded.length,
        failed: failed.length,
      },
      taskIds: succeeded.map((r) => r.value),
      errors: failed.map((r) =>
        r.reason instanceof Error ? r.reason.message : 'Unknown error'
      ),
    });
  } catch (error: unknown) {
    logger.error('[API] Failed to batch queue discovery tasks', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
