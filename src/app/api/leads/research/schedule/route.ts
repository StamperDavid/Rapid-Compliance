/**
 * Research Schedule — GET/PUT /api/leads/research/schedule
 *
 * Stores and retrieves schedule configuration for automated lead research.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const CONFIG_COLLECTION = getSubCollection('lead-research-config');
const SCHEDULE_DOC_ID = 'schedule';

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
  icpProfileId: z.string().min(1).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
  autoApproveThreshold: z.number().min(0).max(100).optional(),
});

// ── GET — Fetch current schedule ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const doc = await AdminFirestoreService.get(CONFIG_COLLECTION, SCHEDULE_DOC_ID);
    if (!doc) {
      return NextResponse.json({ schedule: null });
    }

    return NextResponse.json({ schedule: doc });
  } catch (error: unknown) {
    logger.error('[Schedule] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

// ── PUT — Update schedule config ─────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // Merge with existing config
    const existing = await AdminFirestoreService.get(CONFIG_COLLECTION, SCHEDULE_DOC_ID);
    const schedule = {
      ...(existing ?? {
        enabled: false,
        frequency: 'weekly',
        icpProfileId: '',
        maxResults: 20,
        autoApproveThreshold: 80,
      }),
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.user.uid,
    };

    await AdminFirestoreService.set(CONFIG_COLLECTION, SCHEDULE_DOC_ID, schedule, false);

    return NextResponse.json({ schedule });
  } catch (error: unknown) {
    logger.error('[Schedule] PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}
