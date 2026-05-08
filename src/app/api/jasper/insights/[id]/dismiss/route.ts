/**
 * POST /api/jasper/insights/[id]/dismiss
 *
 * Dismisses a single insight by stamping `dismissedAt = now()` on the
 * doc. The dashboard popup hides any insight that has a `dismissedAt`,
 * so dismissed insights survive in Firestore for audit but never reach
 * the operator's screen again.
 *
 * Idempotent — calling twice is a no-op the second time.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  const { id } = await params;
  if (!id || id === '_meta' || id.length > 200) {
    return NextResponse.json(
      { success: false, error: 'Invalid insight id' },
      { status: 400 },
    );
  }

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore Admin SDK not initialized' },
      { status: 500 },
    );
  }

  try {
    const docRef = adminDb.collection(getSubCollection('jasperInsights')).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 },
      );
    }
    await docRef.set(
      {
        dismissedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ success: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[insights/dismiss] failed',
      err instanceof Error ? err : new Error(msg),
      { route: '/api/jasper/insights/[id]/dismiss', id },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to dismiss insight' },
      { status: 500 },
    );
  }
}
