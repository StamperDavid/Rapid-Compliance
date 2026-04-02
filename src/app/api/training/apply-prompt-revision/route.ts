/**
 * Apply Prompt Revision API
 *
 * POST /api/training/apply-prompt-revision
 *
 * Applies an approved prompt revision by creating a new Golden Master version
 * and deactivating the previously active one. Optionally invalidates the
 * Jasper in-memory cache when the orchestrator GM is updated.
 *
 * Authentication: Required (any authenticated user)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { errors } from '@/lib/middleware/error-handler';
import { invalidateJasperGMCache } from '@/lib/orchestrator/jasper-golden-master';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ApplyRevisionSchema = z.object({
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
  revisedPromptSection: z.string().min(1),
  fullRevisedPrompt: z.string().min(100),
  changeDescription: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Local interface for Firestore document shape
// ---------------------------------------------------------------------------

interface GoldenMasterDoc {
  id: string;
  version: string;
  baseModelId: string;
  agentType: string;
  businessContext: Record<string, unknown>;
  agentPersona: Record<string, unknown>;
  behaviorConfig: Record<string, unknown>;
  knowledgeBase: Record<string, unknown>;
  systemPrompt: string;
  trainedScenarios: string[];
  trainingCompletedAt: string;
  trainingScore: number;
  isActive: boolean;
  deployedAt: string;
  createdBy: string;
  createdAt: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body: unknown = await request.json();
    const parsed = ApplyRevisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload',
          details: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { agentType, fullRevisedPrompt, changeDescription } = parsed.data;

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    // -----------------------------------------------------------------------
    // 1. Load the currently active GM for the given agentType
    // -----------------------------------------------------------------------

    const collectionPath = getSubCollection('goldenMasters');

    const snapshot = await adminDb
      .collection(collectionPath)
      .where('agentType', '==', agentType)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          error: `No active Golden Master found for agentType "${agentType}"`,
        },
        { status: 404 }
      );
    }

    const currentDoc = snapshot.docs[0];
    const currentGM = currentDoc.data() as GoldenMasterDoc;

    // -----------------------------------------------------------------------
    // 2. Compute new version identifiers
    // -----------------------------------------------------------------------

    const currentVersionNumber = parseInt(
      currentGM.version.replace('v', ''),
      10
    );
    const nextVersionNumber = currentVersionNumber + 1;
    const newVersion = `v${nextVersionNumber}`;
    const newGmId = `gm_${agentType}_v${nextVersionNumber}`;
    const nowIso = new Date().toISOString();

    // -----------------------------------------------------------------------
    // 3. Build the new GM document (all fields from current GM, overrides applied)
    // -----------------------------------------------------------------------

    const newGmDocument: GoldenMasterDoc = {
      ...currentGM,
      id: newGmId,
      version: newVersion,
      systemPrompt: fullRevisedPrompt,
      isActive: true,
      deployedAt: nowIso,
      createdAt: nowIso,
      createdBy: user.uid,
      notes: changeDescription,
    };

    // -----------------------------------------------------------------------
    // 4. Deactivate old GM
    // -----------------------------------------------------------------------

    await adminDb.collection(collectionPath).doc(currentDoc.id).update({
      isActive: false,
    });

    // -----------------------------------------------------------------------
    // 5. Persist the new GM document
    // -----------------------------------------------------------------------

    await adminDb.collection(collectionPath).doc(newGmId).set(newGmDocument);

    // -----------------------------------------------------------------------
    // 6. Invalidate caches when the orchestrator GM is updated
    // -----------------------------------------------------------------------

    if (agentType === 'orchestrator') {
      invalidateJasperGMCache();
    }

    logger.info('Prompt revision applied — new Golden Master deployed', {
      route: '/api/training/apply-prompt-revision',
      agentType,
      previousVersion: currentGM.version,
      newVersion,
      newGmId,
      deployedBy: user.uid,
    });

    return NextResponse.json({
      success: true,
      data: {
        newVersionId: newGmId,
        version: newVersion,
        agentType,
      },
    });
  } catch (error: unknown) {
    logger.error(
      'Failed to apply prompt revision',
      error instanceof Error ? error : undefined,
      { route: '/api/training/apply-prompt-revision', method: 'POST' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to apply prompt revision' },
      { status: 500 }
    );
  }
}
