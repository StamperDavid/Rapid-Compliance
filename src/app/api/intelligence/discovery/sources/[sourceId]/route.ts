/**
 * Discovery Source Detail — GET / PUT / DELETE
 * /api/intelligence/discovery/sources/[sourceId]
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getSource,
  updateSource,
  deleteSource,
} from '@/lib/intelligence/discovery-source-service';
import { UpdateDiscoverySourceSchema } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

// ── GET — Fetch source detail ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { sourceId } = await params;
    const source = await getSource(sourceId);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error: unknown) {
    logger.error('[Discovery Source] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch source' }, { status: 500 });
  }
}

// ── PUT — Update source ──────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { sourceId } = await params;

    const existing = await getSource(sourceId);
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateDiscoverySourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    await updateSource(sourceId, parsed.data);
    const updated = await getSource(sourceId);

    return NextResponse.json({ source: updated });
  } catch (error: unknown) {
    logger.error('[Discovery Source] PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  }
}

// ── DELETE — Remove source ───────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { sourceId } = await params;

    const existing = await getSource(sourceId);
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    await deleteSource(sourceId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[Discovery Source] DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}
