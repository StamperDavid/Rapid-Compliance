export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getWorkflows, createWorkflow, type WorkflowFilters } from '@/lib/workflows/workflow-service';
import type { Workflow } from '@/types/workflow';
import {
  WorkflowTriggerSchema,
  WorkflowActionSchema,
  WorkflowSettingsSchema,
  TriggerConditionSchema,
  WorkflowStatusSchema,
} from '@/lib/workflow/validation';

const getQuerySchema = z.object({
  status: WorkflowStatusSchema.optional(),
});

const postBodySchema = z.object({
  workflow: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    folder: z.string().optional(),
    status: WorkflowStatusSchema,
    trigger: WorkflowTriggerSchema,
    conditions: z.array(TriggerConditionSchema).optional(),
    conditionOperator: z.enum(['and', 'or']).optional(),
    actions: z.array(WorkflowActionSchema).min(1).max(50),
    settings: WorkflowSettingsSchema.optional(),
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
      status: searchParams.get('status') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { status } = queryResult.data;

    const filters: WorkflowFilters = {};
    if (status) {
      filters.status = status;
    }

    const result = await getWorkflows(filters);

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

    const { workflow } = bodyResult.data;

    // Build workflow input from Zod-validated data.
    // Type assertions bridge from the Zod validation layer (flat schema) to the
    // domain model layer (discriminated unions in types/workflow.ts). The Zod schemas
    // validate structure — the assertion converts from inferred Zod types to domain types.
    const workflowData: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version' | 'stats'> = {
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
      decodedToken.uid
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
