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
      success: true,
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

    // Build type-safe workflow input from validated Zod data
    // Zod validates the structure but types are loose, so we cast through Partial for type safety
    const workflowData: Omit<Workflow, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version' | 'stats'> = {
      name: workflow.name,
      description: workflow.description,
      icon: workflow.icon,
      folder: workflow.folder,
      status: workflow.status,
      trigger: workflow.trigger as unknown as Workflow['trigger'],
      conditions: workflow.conditions as unknown as Workflow['conditions'],
      conditionOperator: workflow.conditionOperator,
      actions: workflow.actions as unknown as Workflow['actions'],
      settings: (workflow.settings ?? {}) as unknown as Workflow['settings'],
      permissions: workflow.permissions ?? {
        canView: [],
        canEdit: [],
        canExecute: [],
      },
    };

    const newWorkflow = await createWorkflow(
      workflowData,
      decodedToken.uid,
      workspaceId
    );

    return NextResponse.json({ success: true, workflow: newWorkflow }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to create workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
