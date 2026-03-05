/**
 * URL Sources — GET/POST/DELETE /api/leads/research/url-sources
 *
 * CRUD for lead research URL sources stored in Firestore.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const COLLECTION = getSubCollection('lead-research-url-sources');

const createSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  label: z.string().max(200).optional(),
});

// ── GET — List all URL sources ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const docs = await AdminFirestoreService.getAll(COLLECTION);
    const sources = (docs ?? []).sort((a, b) => {
      const aTime = typeof a.addedAt === 'string' ? a.addedAt : '';
      const bTime = typeof b.addedAt === 'string' ? b.addedAt : '';
      return bTime.localeCompare(aTime);
    });

    return NextResponse.json({ sources });
  } catch (error: unknown) {
    logger.error('[URL Sources] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch URL sources' }, { status: 500 });
  }
}

// ── POST — Add a new URL source ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const id = `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const source = {
      id,
      url: parsed.data.url,
      label: parsed.data.label ?? null,
      status: 'pending',
      addedAt: new Date().toISOString(),
      addedBy: authResult.user.uid,
    };

    await AdminFirestoreService.set(COLLECTION, id, source, false);

    return NextResponse.json({ source }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[URL Sources] POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to add URL source' }, { status: 500 });
  }
}

// ── DELETE — Remove a URL source by ID ───────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 });
    }

    await AdminFirestoreService.delete(COLLECTION, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[URL Sources] DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to delete URL source' }, { status: 500 });
  }
}
