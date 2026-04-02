/**
 * Propose Prompt Revision API
 *
 * POST /api/training/propose-prompt-revision
 *
 * Receives an owner correction and delegates to the Prompt Engineer Agent to
 * produce a targeted, section-level edit proposal for the relevant agent's
 * active Golden Master system prompt.
 *
 * Authentication: Required (any authenticated user)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getActiveJasperGoldenMaster } from '@/lib/orchestrator/jasper-golden-master';
import { proposePromptRevision } from '@/lib/training/prompt-engineer-agent';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { AgentDomain } from '@/types/training';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ProposeRevisionSchema = z.object({
  agentType: z.enum([
    'chat',
    'content',
    'social',
    'email',
    'voice',
    'seo',
    'video',
    'orchestrator',
    'sales_chat',
  ]),
  correction: z.string().min(1).max(2000),
  context: z.string().max(500).optional().default('Manual correction'),
});

// ---------------------------------------------------------------------------
// Firestore document shape for non-orchestrator Golden Masters
// ---------------------------------------------------------------------------

interface FirestoreGMDocument {
  systemPrompt?: string;
  agentType?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = ProposeRevisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { agentType, correction, context } = parsed.data;

    // -----------------------------------------------------------------------
    // Load the active Golden Master for the requested agent type
    // -----------------------------------------------------------------------

    let currentSystemPrompt: string;

    if (agentType === 'orchestrator') {
      const gm = await getActiveJasperGoldenMaster();

      if (gm === null) {
        return NextResponse.json(
          { success: false, error: 'No active Golden Master found for orchestrator' },
          { status: 404 },
        );
      }

      currentSystemPrompt = gm.systemPrompt;
    } else {
      if (!adminDb) {
        return NextResponse.json(
          { success: false, error: 'Database not available' },
          { status: 503 },
        );
      }

      const snapshot = await adminDb
        .collection(getSubCollection('goldenMasters'))
        .where('agentType', '==', agentType)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return NextResponse.json(
          {
            success: false,
            error: `No active Golden Master found for agent type: ${agentType}`,
          },
          { status: 404 },
        );
      }

      const raw = snapshot.docs[0].data() as FirestoreGMDocument;

      if (!raw.systemPrompt) {
        return NextResponse.json(
          {
            success: false,
            error: `Golden Master for agent type "${agentType}" has no system prompt`,
          },
          { status: 422 },
        );
      }

      currentSystemPrompt = raw.systemPrompt;
    }

    // -----------------------------------------------------------------------
    // Delegate to the Prompt Engineer Agent
    // -----------------------------------------------------------------------

    const revision = await proposePromptRevision({
      agentType: agentType as AgentDomain,
      currentSystemPrompt,
      correction,
      context,
    });

    return NextResponse.json({ success: true, data: revision });
  } catch (error: unknown) {
    logger.error(
      'propose-prompt-revision failed',
      error instanceof Error ? error : undefined,
      { route: '/api/training/propose-prompt-revision', method: 'POST' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to propose prompt revision' },
      { status: 500 },
    );
  }
}
