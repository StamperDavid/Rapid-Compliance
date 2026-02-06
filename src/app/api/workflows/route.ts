export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getWorkflows, createWorkflow, type WorkflowFilters } from '@/lib/workflows/workflow-service';
import type { Workflow } from '@/types/workflow';

const statusValues = ['draft', 'active', 'paused', 'archived'] as const;

const getQuerySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  status: z.enum(statusValues).optional(),
});

const postBodySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  workflow: z.object({
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    folder: z.string().optional(),
    status: z.enum(statusValues),
    trigger: z.record(z.unknown()),
    conditions: z.array(z.record(z.unknown())).optional(),
    conditionOperator: z.enum(['and', 'or']).optional(),
    actions: z.array(z.record(z.unknown())),
    settings: z.record(z.unknown()).optional(),
    permissions: z.object({
      canView: z.array(z.string()),
      canEdit: z.array(z.string()),
      canExecute: z.array(z.string()),
    }).optional(),
  }),
});

/**
 * GET /api/workflows
 * Get all workflows for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(request.url);
    const queryResult = getQuerySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { workspaceId, status } = queryResult.data;

    const filters: WorkflowFilters = {};
    if (status) {
      filters.status = status;
    }

    const result = await getWorkflows(workspaceId, filters);

    return NextResponse.json({
      workflows: result.data,
      hasMore: result.hasMore,
    });
  } catch (error: unknown) {
    logger.error('Failed to get workflows', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to get workflows';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);

    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);
    if (!bodyResult.success) {
      const firstError = bodyResult.error.errors[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { workspaceId, workflow } = bodyResult.data;

    // Cast to the expected type - the service layer will perform full validation
    const workflowData = workflow as unknown as Omit<Workflow, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version' | 'stats'>;

    const newWorkflow = await createWorkflow(
      workflowData,
      decodedToken.uid,
      workspaceId
    );

    return NextResponse.json({ workflow: newWorkflow }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to create workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
