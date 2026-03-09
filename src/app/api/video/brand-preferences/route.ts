/**
 * Brand Preference API
 *
 * POST — Record a new brand preference from the review workflow
 * GET  — List brand preferences (for admin/debug views)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  recordPreference,
  listPreferences,
  type PreferenceCategory,
} from '@/lib/video/brand-preference-service';

// ============================================================================
// POST — Record a preference
// ============================================================================

const RecordSchema = z.object({
  category: z.enum([
    'approved_prompt',
    'rejected_prompt',
    'style_correction',
    'lighting_preference',
    'camera_preference',
  ]),
  promptPattern: z.string().min(1, 'Prompt pattern is required'),
  feedback: z.string().nullable().optional(),
  sceneType: z.string().nullable().optional(),
  characterRole: z.string().nullable().optional(),
  characterStyle: z.string().nullable().optional(),
  sourceProjectId: z.string().nullable().optional(),
  sourceSceneId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = RecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await recordPreference({
      category: parsed.data.category,
      promptPattern: parsed.data.promptPattern,
      feedback: parsed.data.feedback ?? undefined,
      sceneType: parsed.data.sceneType ?? undefined,
      characterRole: parsed.data.characterRole ?? undefined,
      characterStyle: parsed.data.characterStyle ?? undefined,
      sourceProjectId: parsed.data.sourceProjectId ?? undefined,
      sourceSceneId: parsed.data.sourceSceneId ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to record preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferenceId: result.preferenceId,
    });
  } catch (error) {
    logger.error('Brand preference POST error', error as Error, {
      file: 'api/video/brand-preferences/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — List preferences
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const category = url.searchParams.get('category') as PreferenceCategory | null;
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

    const preferences = await listPreferences({
      category: category ?? undefined,
      limit: Math.min(limit, 100),
    });

    return NextResponse.json({
      success: true,
      preferences,
      count: preferences.length,
    });
  } catch (error) {
    logger.error('Brand preference GET error', error as Error, {
      file: 'api/video/brand-preferences/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
