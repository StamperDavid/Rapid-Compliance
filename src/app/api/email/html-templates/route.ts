/**
 * Custom HTML Email Templates API Route
 * GET:  List custom HTML templates.
 * POST: Upsert (create or replace) a custom HTML template by id.
 *
 * Backs the settings/email-templates page, which stores templates with the
 * `CustomTemplate` shape ({ id, name, type, html, blocks[], preview }) in the
 * `emailTemplates` sub-collection. This is intentionally SEPARATE from
 * `/api/email/templates` (which writes the `emailBuilderTemplates` collection
 * with an incompatible schema).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getEmailTemplatesCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface CustomTemplateDoc {
  id: string;
  name: string;
  type: string;
  html: string;
  blocks: unknown[];
  preview?: string;
  [key: string]: unknown;
}

// Mirrors the page's CustomTemplate shape. `blocks` are page-internal designer
// blocks ({ id, type, content }); validated structurally without coupling to
// the page's BlockType/BlockContent enums.
const designerBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.unknown(),
}).passthrough();

const upsertTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  html: z.string(),
  blocks: z.array(designerBlockSchema).default([]),
  preview: z.string().optional(),
});

/**
 * GET /api/email/html-templates - List custom HTML templates
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const templates = await AdminFirestoreService.getAll<CustomTemplateDoc>(
      getEmailTemplatesCollection()
    );

    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    logger.error('Failed to fetch HTML templates', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/email/html-templates - Upsert a custom HTML template
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = upsertTemplateSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const template = bodyResult.data;

    // merge=true so partial re-saves never drop fields, matching the page's
    // FirestoreService.set(..., true) behavior.
    await AdminFirestoreService.set(
      getEmailTemplatesCollection(),
      template.id,
      template,
      true
    );

    logger.info('HTML template saved', { id: template.id });

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save template';
    logger.error('Failed to save HTML template', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
