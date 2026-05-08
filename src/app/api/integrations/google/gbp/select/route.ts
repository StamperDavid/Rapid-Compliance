/**
 * Google Business Profile — save the operator's chosen location to the
 * central connected-Google doc.
 *
 * POST /api/integrations/google/gbp/select
 * Body: { gbpAccountId: string; gbpLocationId: string; gbpLocationName?: string }
 *
 * Auth: requireRole(['owner','admin']).
 *
 * The selection is the canonical home for "which GBP location does this
 * tenant manage" — the GBP service factory reads it on every post.
 * Replaces the legacy `apiKeys.social.google_business` per-feature record.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import {
  getConnectedGoogleGbpSelection,
  setConnectedGoogleGbpSelection,
} from '@/lib/integrations/google-tokens';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/integrations/google/gbp/select';

const selectionSchema = z.object({
  gbpAccountId: z.string().trim().min(1, 'gbpAccountId is required'),
  gbpLocationId: z.string().trim().min(1, 'gbpLocationId is required'),
  gbpLocationName: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = selectionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      );
    }

    const result = await setConnectedGoogleGbpSelection(parsed.data);
    if (!result.success) {
      const isMissingDoc = (result.error ?? '').toLowerCase().includes('connect google');
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to save GBP selection',
          code: isMissingDoc ? 'no_google_connection' : 'save_failed',
        },
        { status: isMissingDoc ? 503 : 500 },
      );
    }

    const selection = await getConnectedGoogleGbpSelection();
    return NextResponse.json({
      success: true,
      selection,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[gbp-select] handler threw',
      error instanceof Error ? error : new Error(msg),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}

/**
 * GET — return the current selection (used by the picker UI to
 * highlight the previously-chosen location).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const selection = await getConnectedGoogleGbpSelection();
    return NextResponse.json({
      success: true,
      selection,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[gbp-select] GET handler threw',
      error instanceof Error ? error : new Error(msg),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
