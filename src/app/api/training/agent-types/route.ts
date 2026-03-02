/**
 * Agent Type Training Configs API
 *
 * GET /api/training/agent-types — returns available agent types with their configs
 * GET /api/training/agent-types?agentType=voice — returns config for a specific type
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AGENT_TYPE_CONFIGS, getAgentTypeConfig, getAvailableAgentDomains } from '@/lib/training/agent-type-configs';
import { GetAgentTypeConfigsRequestSchema } from '@/lib/training/agent-training-validation';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/agent-types');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const agentTypeParam = searchParams.get('agentType') ?? undefined;

    const parseResult = GetAgentTypeConfigsRequestSchema.safeParse({ agentType: agentTypeParam });
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { agentType } = parseResult.data;

    if (agentType) {
      // Return single config
      const config = getAgentTypeConfig(agentType);
      if (!config) {
        return errors.notFound(`Agent type config not found: ${agentType}`);
      }
      return NextResponse.json({ success: true, config });
    }

    // Return all configs
    return NextResponse.json({
      success: true,
      domains: getAvailableAgentDomains(),
      configs: AGENT_TYPE_CONFIGS,
    });
  } catch (error) {
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch agent type configs'
    );
  }
}
