/**
 * Golden Masters by Agent Type API
 *
 * GET /api/training/golden-masters?agentType=voice — list GMs filtered by agent type
 * POST /api/training/golden-masters — create initial GM for an agent type via factory
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { createInitialGoldenMaster } from '@/lib/training/golden-master-factory';
import {
  ListGoldenMastersByTypeRequestSchema,
  CreateGoldenMasterByTypeRequestSchema,
} from '@/lib/training/agent-training-validation';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import type { GoldenMaster } from '@/types/agent-memory';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/golden-masters');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get('agentType');

    const parseResult = ListGoldenMastersByTypeRequestSchema.safeParse({ agentType });
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'agentType is required');
    }

    if (!adminDb) {
      return errors.internal('Database not available');
    }

    const snap = await adminDb
      .collection(getSubCollection('goldenMasters'))
      .where('agentType', '==', parseResult.data.agentType)
      .orderBy('createdAt', 'desc')
      .get();

    const goldenMasters = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GoldenMaster[];

    return NextResponse.json({
      success: true,
      agentType: parseResult.data.agentType,
      goldenMasters,
      count: goldenMasters.length,
    });
  } catch (error) {
    logger.error('[API] Failed to list golden masters by type', error instanceof Error ? error : new Error(String(error)));
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to list golden masters'
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/golden-masters');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    const body: unknown = await request.json();
    const parseResult = CreateGoldenMasterByTypeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }

    const { agentType, userId } = parseResult.data;

    // Use the authenticated user's ID if not explicitly provided
    const effectiveUserId = userId || user.uid;

    const goldenMaster = await createInitialGoldenMaster(agentType, effectiveUserId);

    logger.info(`[API] Created golden master for ${agentType}`, {
      gmId: goldenMaster.id,
      userId: effectiveUserId,
    });

    return NextResponse.json({
      success: true,
      goldenMaster,
    }, { status: 201 });
  } catch (error) {
    logger.error('[API] Failed to create golden master', error instanceof Error ? error : new Error(String(error)));
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to create golden master'
    );
  }
}
