/**
 * Workflow Execution API
 *
 * POST /api/workflows/execute
 *
 * Execute a workflow manually with provided context
 *
 * REQUEST BODY:
 * ```json
 * {
 *   "workflowId": "workflow_123",
 *   "workspaceId": "workspace_123",
 *   "dealId": "deal_456",
 *   "triggerData": {},
 *   "userId": "user_789"
 * }
 * ```
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { getWorkflowService } from '@/lib/workflow/workflow-service';
import { validateWorkflowExecution } from '@/lib/workflow/validation';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.STANDARD);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 2. Parse and validate request body
    const body: unknown = await request.json();
    const validation = validateWorkflowExecution(body);

    if (validation.success === false) {
      logger.warn('Invalid workflow execution request', {
        error: validation.error,
        details: validation.details ? JSON.stringify(validation.details) : undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          details: validation.details,
        },
        { status: 400 }
      );
    }

    const validData = validation.data;

    // 3. Execute workflow
    logger.info('Executing workflow', {
      workflowId: validData.workflowId,
      dealId: validData.dealId,
    });

    // Cast admin Firestore to client Firestore type - they share same API at runtime
    const dal = new BaseAgentDAL(db as unknown as Firestore);
    const service = getWorkflowService(dal);

    const result = await service.executeWorkflow(
      validData.workflowId,
      {
        workspaceId: validData.workspaceId,
        dealId: validData.dealId,
        triggeredBy: 'manual',
        triggerData: validData.triggerData ?? {},
        userId: validData.userId,
      }
    );

    const duration = Date.now() - startTime;

    logger.info('Workflow execution completed', {
      workflowId: validData.workflowId,
      success: result.success,
      actionsExecuted: result.actionsExecuted.length,
      durationMs: duration,
    });

    // 4. Return result
    return NextResponse.json(
      {
        success: result.success,
        executionId: result.executionId,
        workflowId: validData.workflowId,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt?.toISOString(),
        durationMs: result.durationMs,
        actionsExecuted: result.actionsExecuted,
        error: result.error,
      },
      { status: result.success ? 200 : 500 }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    logger.error('Unexpected error in workflow execution endpoint', error instanceof Error ? error : new Error(String(error)), {
      durationMs: duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
