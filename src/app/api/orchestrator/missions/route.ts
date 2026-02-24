/**
 * Missions API — Create and list missions for Mission Control
 *
 * POST /api/orchestrator/missions — Create a new mission
 * GET  /api/orchestrator/missions — List missions with optional filters
 *
 * Authentication: Required (any authenticated user)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import {
  createMission,
  listMissions,
  type MissionStatus,
} from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateMissionSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  title: z.string().min(1, 'title is required'),
  userPrompt: z.string().min(1, 'userPrompt is required'),
});

const VALID_STATUSES: MissionStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
];

// ============================================================================
// POST — Create a new mission
// ============================================================================

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = CreateMissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { conversationId, title, userPrompt } = parsed.data;
    const missionId = `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await createMission({
      missionId,
      conversationId,
      status: 'PENDING',
      title,
      userPrompt,
      steps: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { success: true, data: { missionId } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      'Mission creation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to create mission' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — List missions with optional filters
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const startAfterParam = searchParams.get('startAfter');

    // Validate status if provided
    let status: MissionStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as MissionStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      status = statusParam as MissionStatus;
    }

    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 50) : 20;

    const { missions, hasMore } = await listMissions({
      status,
      limit,
      startAfter: startAfterParam ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { missions, hasMore },
    });
  } catch (error: unknown) {
    logger.error(
      'Mission list failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to list missions' },
      { status: 500 }
    );
  }
}
