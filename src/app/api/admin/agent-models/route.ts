export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import {
  listAgentModels,
  changeAgentModel,
  rollbackAgentToVersion,
  listAgentModelVersions,
  AVAILABLE_MODELS,
} from '@/lib/training/agent-model-service';

/**
 * GET /api/admin/agent-models
 *   -> { agents: AgentModelInfo[], availableModels }
 * GET /api/admin/agent-models?agentId=<id>&history=1
 *   -> { versions: AgentModelVersion[] }  (for the rollback UI)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const history = searchParams.get('history');

    if (agentId && history) {
      const versions = await listAgentModelVersions(agentId);
      return NextResponse.json({ success: true, versions });
    }

    const agents = await listAgentModels();
    return NextResponse.json({ success: true, agents, availableModels: AVAILABLE_MODELS });
  } catch (error) {
    logger.error(
      'Failed to list agent models',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/admin/agent-models' },
    );
    return NextResponse.json({ error: 'Failed to list agent models' }, { status: 500 });
  }
}

const postSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('change'), agentId: z.string().min(1), model: z.string().min(1) }),
  z.object({ action: z.literal('rollback'), agentId: z.string().min(1), version: z.number().int().positive() }),
]);

/**
 * POST /api/admin/agent-models
 *   { action: 'change', agentId, model }     -> creates a new versioned GM + deploys
 *   { action: 'rollback', agentId, version } -> redeploys an earlier version
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body: unknown = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }

    const createdBy = authResult.user.email || authResult.user.uid;

    if (parsed.data.action === 'change') {
      if (!AVAILABLE_MODELS.includes(parsed.data.model as (typeof AVAILABLE_MODELS)[number])) {
        return NextResponse.json({ error: `Unknown model: ${parsed.data.model}` }, { status: 400 });
      }
      const result = await changeAgentModel(parsed.data.agentId, parsed.data.model, createdBy);
      return result.success
        ? NextResponse.json({ success: true, version: result.version })
        : NextResponse.json({ error: result.error }, { status: 400 });
    }

    const result = await rollbackAgentToVersion(parsed.data.agentId, parsed.data.version);
    return result.success
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: result.error }, { status: 400 });
  } catch (error) {
    logger.error(
      'Failed to update agent model',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/admin/agent-models' },
    );
    return NextResponse.json({ error: 'Failed to update agent model' }, { status: 500 });
  }
}
