/**
 * Creative Studio — Presets
 * GET  /api/studio/presets — List built-in + custom presets
 * POST /api/studio/presets — Save a custom preset
 *
 * Built-in presets come from the cinematic-presets library.
 * Custom presets are stored in Firestore per-user.
 * Query params: category, search, custom ('true' for user presets only)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getAllPresets,
  getPresetsByCategory,
  searchPresets,
} from '@/lib/ai/cinematic-presets';
import {
  SavePresetSchema,
  type CinematicPreset,
  type CustomPreset,
  type PresetCategory,
} from '@/types/creative-studio';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const PRESETS_COLLECTION = getSubCollection('studio-presets');

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PresetCategory | null;
    const search = searchParams.get('search');
    const customOnly = searchParams.get('custom') === 'true';

    // 3. Gather built-in presets (unless requesting custom only)
    let builtInPresets: (CinematicPreset & { source: 'built-in' })[] = [];

    if (!customOnly) {
      let rawPresets: CinematicPreset[];

      if (search) {
        rawPresets = searchPresets(search);
      } else if (category) {
        rawPresets = getPresetsByCategory(category);
      } else {
        rawPresets = getAllPresets();
      }

      builtInPresets = rawPresets.map((p) => ({ ...p, source: 'built-in' as const }));
    }

    // 4. Gather custom presets from Firestore
    let customPresets: (CustomPreset & { source: 'custom' })[] = [];

    if (adminDb) {
      const customSnapshot = await adminDb
        .collection(PRESETS_COLLECTION)
        .where('userId', '==', user.uid)
        .get();

      const allCustom = customSnapshot.docs.map((doc) => {
        const data = doc.data() as CustomPreset;
        return { ...data, source: 'custom' as const };
      });

      // Apply local search/category filtering to custom presets too
      if (search) {
        const q = search.toLowerCase();
        customPresets = allCustom.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q)),
        );
      } else {
        customPresets = allCustom;
      }
    }

    logger.info('Studio presets: listed presets', {
      builtIn: builtInPresets.length,
      custom: customPresets.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        builtIn: builtInPresets,
        custom: customPresets,
        total: builtInPresets.length + customPresets.length,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio presets GET: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    // 2. Validate body
    const body: unknown = await request.json();
    const validated = SavePresetSchema.parse(body);

    // 3. Check Firestore availability
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    // 4. Save to Firestore
    const docRef = adminDb.collection(PRESETS_COLLECTION).doc();
    const now = new Date().toISOString();

    const preset: CustomPreset = {
      id: docRef.id,
      name: validated.name,
      description: validated.description,
      config: validated.config,
      userId: user.uid,
      isPublic: validated.isPublic,
      tags: validated.tags,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(preset);

    logger.info('Studio presets POST: saved custom preset', {
      presetId: docRef.id,
      userId: user.uid,
      name: validated.name,
    });

    return NextResponse.json({
      success: true,
      data: preset,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio presets POST: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
