/**
 * Finding Detail — GET / PATCH /api/intelligence/discovery/findings/[findingId]
 *
 * GET: Fetch a single finding with full enrichment data.
 * PATCH: Update approval status (approve / reject).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getFinding,
  updateFindingApproval,
} from '@/lib/intelligence/discovery-service';
import { UpdateFindingApprovalSchema } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

// ── GET — Fetch finding detail ────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { findingId } = await params;
    const finding = await getFinding(findingId);

    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ finding });
  } catch (error: unknown) {
    logger.error('[Discovery Finding] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch finding' }, { status: 500 });
  }
}

// ── PATCH — Update approval status ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { findingId } = await params;

    const existing = await getFinding(findingId);
    if (!existing) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateFindingApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    await updateFindingApproval(
      findingId,
      parsed.data.approvalStatus,
      authResult.user.uid,
      parsed.data.rejectionNotes
    );

    const updated = await getFinding(findingId);
    return NextResponse.json({ finding: updated });
  } catch (error: unknown) {
    logger.error('[Discovery Finding] PATCH failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 });
  }
}
