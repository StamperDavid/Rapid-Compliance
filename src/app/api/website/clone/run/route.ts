/**
 * Site Clone — capture & import API
 *
 * POST /api/website/clone/run
 * Creates a Mission Control MISSION for the clone job, then — one step per
 * selected page — faithfully captures the live page in headless Chromium
 * (`captureSite`), maps it into our editable `Page` model (`captureToPage`),
 * and saves it as a DRAFT in the canonical page store
 * (`${getSubCollection('website')}/pages/items`). Each page is its own mission
 * step (RUNNING → COMPLETED/FAILED) and its own try/catch, so one failure never
 * aborts the batch. The operator reviews + grades the whole job in Mission
 * Control at `/mission-control?mission=<missionId>`.
 *
 * SAFETY: cloned pages are always DRAFTS. Publishing is a separate, deliberate
 * step — the live public site is never touched here.
 */

import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { captureSite } from '@/lib/website-builder/site-capture';
import { captureToPage } from '@/lib/website-builder/capture-to-page';
import {
  createMission,
  addMissionStep,
  markStepDone,
  finalizeMission,
  type Mission,
} from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';
// Capture is heavy (headless Chromium per page); give the batch generous room.
export const maxDuration = 300;

/** Max pages a single run may capture — guards against a runaway batch. */
const MAX_PATHS = 30;
/** Per-page capture timeout. */
const CAPTURE_TIMEOUT_MS = 60_000;
/** Which agent owns clone steps in Mission Control. */
const WEBSITE_AGENT = 'BUILDER';

const RunSchema = z.object({
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
  paths: z.array(z.string()).min(1).max(MAX_PATHS),
  slugPrefix: z.string().trim().max(60).optional(),
});

/** Outcome of cloning one selected path. */
export interface CloneRunResult {
  path: string;
  slug: string;
  title: string;
  status: 'cloned' | 'failed';
  editorLink?: string;
  error?: string;
}

/** Response shape on success. */
export interface RunResponse {
  success: true;
  missionId: string;
  results: CloneRunResult[];
}

/** Sanitize an arbitrary string into a safe, lowercase slug fragment. */
function sanitizeFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derive a page slug from a pathname. Home (`/` or empty) → `home`; other paths
 * → their sanitized segments joined by `-`. A `slugPrefix` is prepended when
 * given. `used` guarantees uniqueness across the batch AND against existing
 * pages by appending `-2`, `-3`, … on collision.
 */
function deriveSlug(path: string, slugPrefix: string | undefined, used: Set<string>): string {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  const base = normalized === '' ? 'home' : sanitizeFragment(normalized);
  const prefix = slugPrefix !== undefined && slugPrefix !== '' ? `${sanitizeFragment(slugPrefix)}-` : '';
  const candidateBase = `${prefix}${base === '' ? 'page' : base}`;

  let candidate = candidateBase;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${candidateBase}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

/** Build the absolute page URL for a selected pathname against the site origin. */
function buildPageUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = RunSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { url, paths, slugPrefix } = parsed.data;
    const origin = new URL(url).origin;
    const performedBy = await getUserIdentifier();

    const pagesRef = adminDal.getNestedCollection(`${getSubCollection('website')}/pages/items`);

    // Seed the uniqueness set with slugs that already exist so we never clobber
    // a page a user already has.
    const used = new Set<string>();
    try {
      const existingSnap = await pagesRef.get();
      existingSnap.forEach((doc) => { used.add(doc.id); });
    } catch (existErr) {
      logger.warn('[Clone Run] Could not preload existing slugs', {
        route: '/api/website/clone/run',
        error: existErr instanceof Error ? existErr.message : String(existErr),
      });
    }

    // ── Create the mission (one step per selected page is appended below). ──
    const missionId = `mission_clone_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const mission: Mission = {
      missionId,
      conversationId: `clone_${missionId}`,
      status: 'IN_PROGRESS',
      title: `Clone ${origin} — ${paths.length} page${paths.length === 1 ? '' : 's'}`,
      userPrompt: `Clone ${paths.length} page(s) from ${origin} into draft pages: ${paths.join(', ')}`,
      steps: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await createMission(mission);

    logger.info('[Clone Run] Mission created', {
      route: '/api/website/clone/run',
      missionId,
      origin,
      pathCount: paths.length,
    });

    const results: CloneRunResult[] = [];

    // Sequential: capture is heavy (one headless browser at a time). Each page
    // is its own mission step (RUNNING → COMPLETED/FAILED) and its own
    // try/catch so a single failure never aborts the batch.
    for (const [index, path] of paths.entries()) {
      const slug = deriveSlug(path, slugPrefix, used);
      const pageUrl = buildPageUrl(origin, path);
      const stepId = `clone_step_${missionId}_${index + 1}`;
      const stepStart = Date.now();

      await addMissionStep(missionId, {
        stepId,
        toolName: 'clone_page',
        delegatedTo: WEBSITE_AGENT,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        summary: `Cloning ${pageUrl} → draft "${slug}"`,
        toolArgs: { pageUrl, slug, path },
      });

      try {
        logger.info('[Clone Run] Capturing page', { route: '/api/website/clone/run', missionId, pageUrl, slug });

        const capture = await captureSite(pageUrl, { timeoutMs: CAPTURE_TIMEOUT_MS });
        const page = captureToPage(capture, { slug });

        const title = page.title !== '' ? page.title : path;
        const savedAt = new Date().toISOString();

        const pageData = {
          ...page,
          id: slug,
          slug,
          title,
          status: 'draft' as const,
          version: 1,
          createdAt: savedAt,
          updatedAt: savedAt,
          createdBy: performedBy,
          lastEditedBy: performedBy,
          // Server timestamps for querying/sorting alongside the ISO fields.
          createdAtTs: FieldValue.serverTimestamp(),
          updatedAtTs: FieldValue.serverTimestamp(),
          clonedFrom: pageUrl,
        };

        await pagesRef.doc(slug).set(pageData);

        const editorLink = `/website/editor?pageId=${encodeURIComponent(slug)}`;

        await markStepDone(missionId, stepId, {
          status: 'COMPLETED',
          durationMs: Date.now() - stepStart,
          toolResult: `Cloned "${title}" from ${pageUrl} → draft page "${slug}". Open in editor: ${editorLink}`,
        });

        logger.info('[Clone Run] Page cloned', { route: '/api/website/clone/run', missionId, slug, title });

        results.push({ path, slug, title, status: 'cloned', editorLink });
      } catch (pageError) {
        const message = pageError instanceof Error ? pageError.message : 'Unknown error';
        logger.error(
          '[Clone Run] Page failed',
          pageError instanceof Error ? pageError : new Error(String(pageError)),
          { route: '/api/website/clone/run', missionId, pageUrl, slug },
        );

        await markStepDone(missionId, stepId, {
          status: 'FAILED',
          durationMs: Date.now() - stepStart,
          toolResult: `Failed to clone ${pageUrl}: ${message}`,
          error: message,
        });

        results.push({ path, slug, title: path, status: 'failed', error: message });
      }
    }

    // Finalize: COMPLETED if at least one page cloned, else FAILED.
    const clonedCount = results.filter((r) => r.status === 'cloned').length;
    if (clonedCount > 0) {
      await finalizeMission(missionId, 'COMPLETED');
    } else {
      await finalizeMission(missionId, 'FAILED', 'No pages could be cloned');
    }

    const body: RunResponse = { success: true, missionId, results };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      '[Clone Run] Batch failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website/clone/run' },
    );
    return NextResponse.json(
      { success: false, message: `Clone run failed: ${message}` },
      { status: 500 },
    );
  }
}
