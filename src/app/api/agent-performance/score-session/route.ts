/**
 * Production Session Scoring API
 *
 * POST /api/agent-performance/score-session
 *
 * Called by chat-session-service (and other agent session services) after
 * a production session completes. Invokes the production monitor to:
 *   1. Score the session
 *   2. Record the score on the session document
 *   3. Auto-flag if below threshold
 *
 * This is a lightweight endpoint — NOT the full coaching analysis.
 * For full coaching + training pipeline, use POST /api/agent-performance/analyze.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { triggerAgentAnalysis } from '@/lib/training/production-monitor';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import type { AgentDomain } from '@/types/training';

export const dynamic = 'force-dynamic';

const ScoreSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  agentType: z.enum(['chat', 'voice', 'email', 'social', 'seo']),
  agentId: z.string().optional(),
  ownerId: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  issues: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const parseResult = ScoreSessionSchema.safeParse(body);

    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { sessionId, agentType, agentId, ownerId, score, issues } = parseResult.data;

    const result = await triggerAgentAnalysis(sessionId, agentType as AgentDomain, {
      agentId,
      ownerId,
      score,
      issues,
    });

    logger.info('[ScoreSession] Production session scored', {
      sessionId,
      agentType,
      score: result.score,
      flagged: result.flagged,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(
      '[ScoreSession] Failed to score session',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to score session'
    );
  }
}
