/**
 * Website Migration API
 * POST /api/website/migrate — Clone an existing website into the website builder.
 * Validates input, runs the migration pipeline, returns results with editor link.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { migrateSite } from '@/lib/website-builder/site-migration-service';
import { logger } from '@/lib/logger/logger';

const migrateBodySchema = z.object({
  sourceUrl: z.string().url('sourceUrl must be a valid URL'),
  maxPages: z.number().int().min(1).max(20).optional().default(10),
  includeImages: z.boolean().optional().default(true),
  missionId: z.string().optional(),
});

/**
 * POST /api/website/migrate
 * Start a website migration from an external URL.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const bodyResult = migrateBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { sourceUrl, maxPages, includeImages, missionId } = bodyResult.data;

    logger.info('Migration API called', {
      sourceUrl,
      maxPages,
      includeImages,
      route: '/api/website/migrate',
    });

    const result = await migrateSite({
      sourceUrl,
      maxPages,
      includeImages,
      missionId,
    });

    const httpStatus = result.status === 'FAILED' ? 500 : 200;

    return NextResponse.json({
      success: result.status !== 'FAILED',
      status: result.status,
      sourceUrl: result.sourceUrl,
      totalPages: result.totalPages,
      successCount: result.successCount,
      failedCount: result.failedCount,
      pages: result.pages,
      brand: result.blueprint.brand,
      editorLink: result.editorLink,
      durationMs: result.durationMs,
      message: result.status === 'COMPLETED'
        ? `Successfully migrated ${result.successCount} pages from ${sourceUrl}. Open ${result.editorLink} to edit.`
        : result.status === 'PARTIAL'
          ? `Migrated ${result.successCount}/${result.totalPages} pages. ${result.failedCount} pages failed.`
          : `Migration failed. Check logs for details.`,
    }, { status: httpStatus });
  } catch (error: unknown) {
    logger.error('Migration API error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/migrate',
      method: 'POST',
    });
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
