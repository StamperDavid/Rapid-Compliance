/**
 * Golden Master Update Requests API
 *
 * GET /api/training/golden-master-updates?agentType=chat&status=pending_review
 *
 * Lists GoldenMasterUpdateRequest documents from Firestore,
 * filtered by agentType and optionally by status.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { adminDb } from '@/lib/firebase/admin';
import { AgentDomainSchema, ImprovementStatusSchema } from '@/lib/training/agent-training-validation';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  agentType: AgentDomainSchema.optional(),
  status: ImprovementStatusSchema.optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/golden-master-updates');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parseResult = QuerySchema.safeParse({
      agentType: searchParams.get('agentType') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid query parameters');
    }

    const { agentType, status } = parseResult.data;

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    // Build Firestore query
    const collectionPath = getSubCollection('goldenMasterUpdates');
    let query: FirebaseFirestore.Query = adminDb.collection(collectionPath);

    if (agentType) {
      query = query.where('agentType', '==', agentType);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc').limit(50);

    const snapshot = await query.get();
    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info('[GoldenMasterUpdatesAPI] Listed update requests', {
      agentType: agentType ?? 'all',
      status: status ?? 'all',
      count: updates.length,
    });

    return NextResponse.json({
      success: true,
      updates,
      count: updates.length,
    });
  } catch (error) {
    logger.error(
      '[GoldenMasterUpdatesAPI] Failed to list update requests',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to list golden master update requests'
    );
  }
}
