/**
 * Onboarding Progress API Route
 *
 * Saves partial onboarding data as the user moves through steps.
 * Uses Firestore merge mode so each save only updates the fields provided.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const progressSchema = z.object({
  currentStep: z.number().min(1).max(24),
  formData: z.record(z.unknown()),
});

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = progressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid progress data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { currentStep, formData } = parsed.data;

    // Strip non-serializable fields (File objects can't go to Firestore)
    const serializable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (key === 'uploadedDocs' || key === 'uploadedSalesMaterials') { continue; }
      if (value !== undefined && value !== null) {
        serializable[key] = value;
      }
    }

    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');

    await AdminFirestoreService.set(
      getSubCollection('onboarding'),
      'current',
      {
        ...serializable,
        currentStep,
        lastSavedAt: new Date().toISOString(),
      },
      true // merge mode — don't overwrite existing fields
    );

    return NextResponse.json({ success: true, currentStep });
  } catch (error) {
    logger.error(
      'Error saving onboarding progress',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/onboarding/progress' }
    );
    return NextResponse.json(
      { error: 'Failed to save onboarding progress' },
      { status: 500 }
    );
  }
}
