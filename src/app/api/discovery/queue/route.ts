/**
 * API Route: Queue Discovery Tasks
 *
 * Endpoint to add new tasks to the discovery queue.
 *
 * POST /api/discovery/queue
 */

import { NextResponse, type NextRequest } from 'next/server';
import { queueDiscoveryTask } from '@/lib/services/discovery-dispatcher';
import { logger } from '@/lib/logger/logger';

/**
 * Discovery task request body schema
 */
interface DiscoveryTaskRequest {
  type: 'company' | 'person';
  target: string;
  priority?: number;
}

/**
 * Batch discovery tasks request body schema
 */
interface BatchDiscoveryTasksRequest {
  tasks: DiscoveryTaskRequest[];
}

/**
 * Type guard to validate discovery task request
 */
function isDiscoveryTaskRequest(body: unknown): body is DiscoveryTaskRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  return (
    (obj.type === 'company' || obj.type === 'person') &&
    typeof obj.target === 'string' &&
    (obj.priority === undefined || typeof obj.priority === 'number')
  );
}

/**
 * Type guard to validate batch tasks request
 */
function isBatchDiscoveryTasksRequest(
  body: unknown
): body is BatchDiscoveryTasksRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  return (
    Array.isArray(obj.tasks) &&
    obj.tasks.every((task) => isDiscoveryTaskRequest(task))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Validate request body structure
    if (!isDiscoveryTaskRequest(body)) {
      return NextResponse.json(
        {
          error:
            'Invalid request body. Must include type (company/person) and target.',
        },
        { status: 400 }
      );
    }

    // Queue the task
    const taskId = await queueDiscoveryTask(
      body.type,
      body.target,
      'default',
      body.priority ?? 0
    );

    logger.info('[API] Discovery task queued', {
      taskId,
      type: body.type,
      target: body.target,
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: `Discovery task queued for ${body.type}: ${body.target}`,
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
    const body: unknown = await request.json();

    // Validate request body structure
    if (!isBatchDiscoveryTasksRequest(body)) {
      return NextResponse.json(
        {
          error:
            'Request body must contain a "tasks" array with valid discovery task objects',
        },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      body.tasks.map((task: DiscoveryTaskRequest) =>
        queueDiscoveryTask(
          task.type,
          task.target,
          'default',
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
      total: body.tasks.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return NextResponse.json({
      success: true,
      stats: {
        total: body.tasks.length,
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
