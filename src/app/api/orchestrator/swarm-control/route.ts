/**
 * Swarm Control API — Global Kill Switch & Per-Agent Controls
 *
 * GET  /api/orchestrator/swarm-control — Get current swarm control state
 * POST /api/orchestrator/swarm-control — Update swarm control state
 *
 * Actions (POST body):
 * - { action: "pause_swarm" }       — Global pause all agents
 * - { action: "resume_swarm" }      — Resume all agents
 * - { action: "pause_manager", managerId: "..." }  — Pause specific manager
 * - { action: "resume_manager", managerId: "..." } — Resume specific manager
 * - { action: "pause_agent", agentId: "..." }      — Pause specific agent
 * - { action: "resume_agent", agentId: "..." }     — Resume specific agent
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getSwarmControlState,
  pauseSwarm,
  resumeSwarm,
  pauseManager,
  resumeManager,
  pauseAgent,
  resumeAgent,
} from '@/lib/orchestration/swarm-control';

export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION
// ============================================================================

const SwarmControlActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause_swarm') }),
  z.object({ action: z.literal('resume_swarm') }),
  z.object({ action: z.literal('pause_manager'), managerId: z.string().min(1) }),
  z.object({ action: z.literal('resume_manager'), managerId: z.string().min(1) }),
  z.object({ action: z.literal('pause_agent'), agentId: z.string().min(1) }),
  z.object({ action: z.literal('resume_agent'), agentId: z.string().min(1) }),
]);

// ============================================================================
// GET — Read current swarm control state
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const state = await getSwarmControlState();

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SwarmControl API] GET failed', error instanceof Error ? error : undefined, {
      route: '/api/orchestrator/swarm-control',
    });
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

// ============================================================================
// POST — Update swarm control state
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const parsed = SwarmControlActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const userId = authResult.user.uid;
    const action = parsed.data;

    let state;

    switch (action.action) {
      case 'pause_swarm':
        state = await pauseSwarm(userId);
        break;
      case 'resume_swarm':
        state = await resumeSwarm(userId);
        break;
      case 'pause_manager':
        state = await pauseManager(action.managerId, userId);
        break;
      case 'resume_manager':
        state = await resumeManager(action.managerId, userId);
        break;
      case 'pause_agent':
        state = await pauseAgent(action.agentId, userId);
        break;
      case 'resume_agent':
        state = await resumeAgent(action.agentId, userId);
        break;
    }

    logger.info('[SwarmControl API] Action executed', {
      action: action.action,
      userId,
    });

    return NextResponse.json({
      success: true,
      action: action.action,
      state,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SwarmControl API] POST failed', error instanceof Error ? error : undefined, {
      route: '/api/orchestrator/swarm-control',
    });
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
