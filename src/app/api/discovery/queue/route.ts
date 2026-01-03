/**
 * API Route: Queue Discovery Tasks
 * 
 * Endpoint to add new tasks to the discovery queue.
 * 
 * POST /api/discovery/queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueDiscoveryTask } from '@/lib/services/discovery-dispatcher';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.type || !['company', 'person'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "company" or "person".' },
        { status: 400 }
      );
    }

    if (!body.target) {
      return NextResponse.json(
        { error: 'Missing target (domain for company, email for person)' },
        { status: 400 }
      );
    }

    if (!body.organizationId || !body.workspaceId) {
      return NextResponse.json(
        { error: 'Missing organizationId or workspaceId' },
        { status: 400 }
      );
    }

    // Queue the task
    const taskId = await queueDiscoveryTask(
      body.type,
      body.target,
      body.organizationId,
      body.workspaceId,
      body.priority || 0
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
  } catch (error) {
    logger.error('[API] Failed to queue discovery task', error);

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
    const body = await request.json();

    if (!Array.isArray(body.tasks)) {
      return NextResponse.json(
        { error: 'Request body must contain a "tasks" array' },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      body.tasks.map((task: any) =>
        queueDiscoveryTask(
          task.type,
          task.target,
          task.organizationId,
          task.workspaceId,
          task.priority || 0
        )
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

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
      taskIds: succeeded.map(r => r.status === 'fulfilled' ? r.value : null),
      errors: failed.map(r => r.status === 'rejected' ? r.reason?.message : null),
    });
  } catch (error) {
    logger.error('[API] Failed to batch queue discovery tasks', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
