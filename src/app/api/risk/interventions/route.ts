/**
 * /api/risk/interventions
 *
 * POST   — Start an intervention for a deal
 * GET    — List interventions for a deal
 * PATCH  — Update intervention status (completed / dismissed)
 *
 * Auth-gated, Zod-validated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ---------------------------------------------------------------------------
// Firestore helper — lazy import to keep module lightweight
// ---------------------------------------------------------------------------

async function getDb() {
  const { adminDb } = await import('@/lib/firebase/admin');
  if (!adminDb) { throw new Error('Firestore not available'); }
  return adminDb;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const StartInterventionSchema = z.object({
  dealId: z.string().min(1, 'dealId is required'),
  interventionId: z.string().min(1, 'interventionId is required'),
  type: z.string().min(1, 'intervention type is required'),
  title: z.string().optional(),
  priority: z.string().optional(),
});

const UpdateInterventionSchema = z.object({
  interventionId: z.string().min(1, 'interventionId is required'),
  status: z.enum(['completed', 'dismissed']),
  outcome: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Firestore path helper
// ---------------------------------------------------------------------------

function interventionsCol(dealId: string) {
  return `organizations/${PLATFORM_ID}/deals/${dealId}/interventions`;
}

// ---------------------------------------------------------------------------
// POST — Start Intervention
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const body: unknown = await request.json();
    const parsed = StartInterventionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { dealId, interventionId, type, title, priority } = parsed.data;
    const db = await getDb();

    const docRef = db.collection(interventionsCol(dealId)).doc(interventionId);
    const record = {
      dealId,
      interventionId,
      type,
      title: title ?? type.replace(/_/g, ' '),
      priority: priority ?? 'medium',
      startedAt: new Date().toISOString(),
      status: 'active' as const,
      startedBy: authResult.user.uid,
    };

    await docRef.set(record);

    logger.info('Intervention started', { dealId, interventionId });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (err) {
    logger.error('Start intervention error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to start intervention',
      err instanceof Error ? err : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// GET — List interventions for a deal
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: 'dealId query parameter is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const snapshot = await db.collection(interventionsCol(dealId)).orderBy('startedAt', 'desc').get();

    const interventions = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json({ success: true, data: interventions });
  } catch (err) {
    logger.error('List interventions error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to list interventions',
      err instanceof Error ? err : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update intervention outcome
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const body: unknown = await request.json();
    const parsed = UpdateInterventionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { interventionId, status, outcome } = parsed.data;

    // We need dealId to locate the document — accept it from query or body
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId') ?? ((body as Record<string, unknown>).dealId as string | undefined);

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: 'dealId is required (query param or body)' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const docRef = db.collection(interventionsCol(dealId)).doc(interventionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Intervention not found' },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = {
      status,
      completedAt: new Date().toISOString(),
      completedBy: authResult.user.uid,
    };
    if (outcome) {
      update.outcome = outcome;
    }

    await docRef.update(update);

    logger.info('Intervention updated', { dealId, interventionId, status });

    return NextResponse.json({ success: true, data: { interventionId, ...update } });
  } catch (err) {
    logger.error('Update intervention error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to update intervention',
      err instanceof Error ? err : undefined
    );
  }
}
