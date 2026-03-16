/**
 * Creative Studio — Generation Status
 * GET /api/studio/generate/[generationId] — Poll generation status
 *
 * Reads the StudioGeneration document from Firestore and returns
 * the current status, result (if completed), or error (if failed).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { StudioGeneration } from '@/types/creative-studio';

export const dynamic = 'force-dynamic';

const GENERATIONS_COLLECTION = getSubCollection('studio-generations');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> },
) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    // 2. Get generationId from params
    const { generationId } = await params;

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'Generation ID is required' },
        { status: 400 },
      );
    }

    // 3. Read from Firestore
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    const docSnap = await adminDb.collection(GENERATIONS_COLLECTION).doc(generationId).get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Generation not found' },
        { status: 404 },
      );
    }

    const generation = docSnap.data() as StudioGeneration;

    logger.debug('Studio generate status: fetched', {
      generationId,
      status: generation.status,
    });

    return NextResponse.json({
      success: true,
      data: generation,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio generate status: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
