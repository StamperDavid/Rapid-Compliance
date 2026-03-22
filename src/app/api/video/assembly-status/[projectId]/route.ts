/**
 * GET /api/video/assembly-status/[projectId]
 * Returns the current assembly progress for a project.
 * Progress is written to Firestore by the /api/video/assemble route at each phase.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { projectId } = await params;

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Database unavailable' },
      { status: 503 },
    );
  }

  const doc = await adminDb
    .collection('organizations')
    .doc(PLATFORM_ID)
    .collection('assembly_progress')
    .doc(projectId)
    .get();

  if (!doc.exists) {
    return NextResponse.json({
      success: true,
      progress: null,
    });
  }

  const data = doc.data() as {
    phase: string;
    phaseLabel: string;
    phaseIndex: number;
    totalPhases: number;
    sceneProgress?: string;
    updatedAt: string;
    completedAt?: string;
    error?: string;
  };

  return NextResponse.json({
    success: true,
    progress: data,
  });
}
