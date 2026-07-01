/**
 * Site Clone — page discovery API
 *
 * POST /api/website/clone/discover
 * Takes a client site URL and returns the same-origin pages a user can pick to
 * clone. This is the CHEAP step: a single HTTP fetch + HTML parse (no headless
 * browser). The heavy faithful capture happens per selected page in the sibling
 * `clone/run` route.
 *
 * SAFETY: read-only. Nothing is written here and the live site is never touched.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { discoverPages, type DiscoveredPage } from '@/lib/website-builder/site-crawler';

export const dynamic = 'force-dynamic';

const DiscoverSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine(
      (value) => {
        try {
          const { protocol } = new URL(value);
          return protocol === 'http:' || protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Only http(s) URLs are supported' },
    ),
  maxPages: z.number().int().min(1).max(50).optional(),
});

/** Response shape on success. */
export interface DiscoverResponse {
  success: true;
  origin: string;
  pages: DiscoveredPage[];
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = DiscoverSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { url, maxPages } = parsed.data;
    const origin = new URL(url).origin;

    logger.info('[Clone Discover] Discovering pages', { route: '/api/website/clone/discover', origin, maxPages });

    const pages = await discoverPages(url, maxPages === undefined ? {} : { maxPages });

    logger.info('[Clone Discover] Discovery complete', {
      route: '/api/website/clone/discover',
      origin,
      pageCount: pages.length,
    });

    const body: DiscoverResponse = { success: true, origin, pages };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      '[Clone Discover] Failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website/clone/discover' },
    );
    return NextResponse.json(
      { success: false, message: `Could not discover pages: ${message}` },
      { status: 502 },
    );
  }
}
