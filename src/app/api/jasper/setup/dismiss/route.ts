/**
 * POST /api/jasper/setup/dismiss
 *
 * Operator clicked "Stop reminding me" on a setup item. We persist the
 * item's `key` to the dismissed map so subsequent GET /api/jasper/insights
 * calls filter it out of the popup forever (or until the operator
 * resets their preferences elsewhere).
 *
 * Doc path: `organizations/{tenantId}/setupReminders/dismissed`
 * Doc shape: `{ keys: { [setupItemKey: string]: { dismissedAt: ISO } } }`
 *
 * Idempotent — a second call with the same key updates the timestamp
 * but does not error.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const dismissBodySchema = z.object({
  key: z
    .string()
    .min(1, 'key is required')
    .max(120, 'key must be <= 120 chars')
    .regex(/^[a-zA-Z0-9._\-:/]+$/, 'key must be alphanumeric with . _ - : /'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  let parsed;
  try {
    const raw: unknown = await request.json();
    parsed = dismissBodySchema.safeParse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Invalid JSON body: ${msg}` },
      { status: 400 },
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  const { key } = parsed.data;

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore Admin SDK not initialized' },
      { status: 500 },
    );
  }

  try {
    const docRef = adminDb
      .collection(getSubCollection('setupReminders'))
      .doc('dismissed');
    const dismissedAt = new Date().toISOString();
    // merge:true ensures other dismissed keys are preserved.
    await docRef.set(
      {
        keys: {
          [key]: { dismissedAt },
        },
        updatedAt: dismissedAt,
      },
      { merge: true },
    );
    return NextResponse.json({ success: true, key, dismissedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[setup/dismiss] failed',
      err instanceof Error ? err : new Error(msg),
      { route: '/api/jasper/setup/dismiss', key },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to dismiss setup reminder' },
      { status: 500 },
    );
  }
}
