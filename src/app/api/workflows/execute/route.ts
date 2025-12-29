import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflowImpl as executeWorkflow } from '@/lib/workflows/workflow-engine';
import { Workflow } from '@/types/workflow';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { workflowExecuteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/workflows/execute');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(workflowExecuteSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const data = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== data.organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    // Handle both workflow object and workflowId variants
    let workflow: Workflow;
    if ('workflow' in data) {
      workflow = data.workflow as Workflow;
    } else if ('workflowId' in data) {
      // Load workflow from database using workflowId
      const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
      const { COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const loadedWorkflow = await AdminFirestoreService.get(
        COLLECTIONS.WORKFLOWS,
        data.workflowId
      );
      
      if (!loadedWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      workflow = loadedWorkflow as Workflow;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request: workflow or workflowId required' },
        { status: 400 }
      );
    }

    // Execute workflow
    const execution = await executeWorkflow(workflow, {
      ...data.triggerData,
      userId: user.uid,
      organizationId: data.organizationId,
    });

    return NextResponse.json({
      success: execution.status === 'completed',
      execution,
    });
  } catch (error: any) {
    logger.error('Workflow execution error', error, { route: '/api/workflows/execute' });
    return errors.internal('Failed to execute workflow', error);
  }
}

