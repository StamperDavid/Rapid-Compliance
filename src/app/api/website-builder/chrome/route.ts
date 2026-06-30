/**
 * Website-builder Site Chrome — DRAFT store API
 *
 * Persists the editor's site chrome (early-access banner / nav header / footer)
 * to a single DRAFT document, and reads it back. This is the store that
 * `loadSiteChrome()` (`src/lib/website-builder/site-chrome-service.ts`,
 * `SITE_CHROME_API_PATH`) already reads, so the website editor round-trips its
 * banner/header/footer edits through here.
 *
 * SAFETY: this is an EDITOR-SIDE DRAFT only. The live public site chrome is
 * rendered by `PublicLayout` / `EarlyAccessBanner`, which do NOT read this
 * document. Saving here can never change production. Applying a draft to the
 * live site is a separate, deliberate step (not built here).
 *
 * Doc path: `${getSubCollection('website')}/chrome` (a dedicated draft doc,
 * separate from `.../website/pages/items`).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const CHROME_DOC_PATH = `${getSubCollection('website')}/chrome`;

// Mirrors the `SiteChrome` contract in
// `src/lib/website-builder/site-chrome-types.ts`. The service's
// `normalizeSiteChrome` re-shapes anything sparse/stale on read, so this schema
// stays permissive on optional fields while validating structure.
const ChromeLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

const SiteChromeSchema = z.object({
  banner: z.object({
    enabled: z.boolean(),
    text: z.string(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
  }),
  header: z.object({
    logoUrl: z.string(),
    links: z.array(ChromeLinkSchema),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
  }),
  footer: z.object({
    columns: z.array(
      z.object({
        title: z.string(),
        links: z.array(ChromeLinkSchema),
      }),
    ),
    copyright: z.string(),
  }),
});

const PutChromeSchema = z.object({
  chrome: SiteChromeSchema,
});

/**
 * GET /api/website-builder/chrome
 * Returns the saved draft chrome as `{ chrome }`, or `{ chrome: null }` when no
 * draft has been saved yet (the service then falls back to DEFAULT_SITE_CHROME).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const docRef = adminDal.getNestedDocRef(CHROME_DOC_PATH);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ chrome: null });
    }

    const data = snap.data() as Record<string, unknown> | undefined;
    const chrome: unknown = data?.chrome ?? null;
    return NextResponse.json({ chrome });
  } catch (error) {
    logger.error(
      '[Website Chrome API] GET error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website-builder/chrome' },
    );
    return NextResponse.json({ error: 'Failed to load site chrome' }, { status: 500 });
  }
}

/**
 * PUT /api/website-builder/chrome
 * Saves the editor's draft chrome. EDITOR-SIDE ONLY — never touches the live site.
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const rawBody: unknown = await request.json();
    const parsed = PutChromeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid site chrome', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const performedBy = await getUserIdentifier();
    const docRef = adminDal.getNestedDocRef(CHROME_DOC_PATH);
    await docRef.set(
      {
        chrome: parsed.data.chrome,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: performedBy,
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, chrome: parsed.data.chrome });
  } catch (error) {
    logger.error(
      '[Website Chrome API] PUT error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website-builder/chrome' },
    );
    return NextResponse.json({ error: 'Failed to save site chrome' }, { status: 500 });
  }
}
