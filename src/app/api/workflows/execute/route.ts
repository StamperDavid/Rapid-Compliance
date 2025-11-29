import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflows/workflow-engine';
import { Workflow } from '@/types/workflow';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { workflowExecuteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { organizationId, workflow, triggerData } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Execute workflow
    const execution = await executeWorkflow(workflow as Workflow, {
      ...triggerData,
      userId: user.uid,
      organizationId,
    });

    return NextResponse.json({
      success: execution.status === 'completed',
      execution,
    });
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute workflow' },
      { status: 500 }
    );
  }
}

