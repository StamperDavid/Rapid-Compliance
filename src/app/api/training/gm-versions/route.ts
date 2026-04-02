/**
 * GM Versions API
 *
 * GET /api/training/gm-versions?agentType=orchestrator
 *
 * Returns all Golden Master versions for a given agentType, ordered by
 * createdAt descending. Intended for the GM Version Control UI.
 *
 * Authentication: Required (any authenticated user)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { AgentDomainSchema } from '@/lib/training/agent-training-validation';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Firestore document shape — only the fields the UI needs
// ---------------------------------------------------------------------------

interface GMVersionDoc {
  id: string;
  version: string;
  systemPrompt: string;
  isActive: boolean;
  deployedAt: string;
  createdAt: string;
  createdBy: string;
  notes: string;
  agentType: string;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const agentTypeRaw = searchParams.get('agentType');

    const parseResult = AgentDomainSchema.safeParse(agentTypeRaw);
    if (!parseResult.success) {
      return errors.badRequest(
        parseResult.error.errors[0]?.message ?? 'agentType is required and must be a valid agent domain'
      );
    }

    const agentType = parseResult.data;

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    const snap = await adminDb
      .collection(getSubCollection('goldenMasters'))
      .where('agentType', '==', agentType)
      .orderBy('createdAt', 'desc')
      .get();

    const versions: GMVersionDoc[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        version: typeof data['version'] === 'string' ? data['version'] : String(data['version'] ?? ''),
        systemPrompt: typeof data['systemPrompt'] === 'string' ? data['systemPrompt'] : '',
        isActive: Boolean(data['isActive']),
        deployedAt: typeof data['deployedAt'] === 'string' ? data['deployedAt'] : '',
        createdAt: typeof data['createdAt'] === 'string' ? data['createdAt'] : '',
        createdBy: typeof data['createdBy'] === 'string' ? data['createdBy'] : '',
        notes: typeof data['notes'] === 'string' ? data['notes'] : '',
        agentType: typeof data['agentType'] === 'string' ? data['agentType'] : agentType,
      };
    });

    logger.info('[API] Fetched GM versions', {
      route: '/api/training/gm-versions',
      agentType,
      count: versions.length,
    });

    return NextResponse.json({
      success: true,
      agentType,
      versions,
      count: versions.length,
    });
  } catch (error: unknown) {
    logger.error(
      '[API] Failed to fetch GM versions',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/training/gm-versions' }
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch GM versions'
    );
  }
}
