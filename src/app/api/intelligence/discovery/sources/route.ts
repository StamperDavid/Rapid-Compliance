/**
 * Discovery Sources — GET (list) / POST (create)
 * /api/intelligence/discovery/sources
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  listSources,
  createSource,
  createSourceFromTemplate,
  getSourceTemplates,
} from '@/lib/intelligence/discovery-source-service';
import { CreateDiscoverySourceSchema } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

const FromTemplateSchema = z.object({
  templateId: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

// ── GET — List all sources + templates ────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const sources = await listSources();
    const templates = getSourceTemplates();

    return NextResponse.json({ sources, templates });
  } catch (error: unknown) {
    logger.error('[Discovery Sources] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list sources' }, { status: 500 });
  }
}

// ── POST — Create source (from scratch or template) ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();

    // Check if creating from template
    const templateParsed = FromTemplateSchema.safeParse(body);
    if (templateParsed.success) {
      const source = await createSourceFromTemplate(
        templateParsed.data.templateId,
        authResult.user.uid,
        templateParsed.data.overrides as Record<string, never> | undefined
      );

      if (!source) {
        return NextResponse.json(
          { error: 'Template not found', templateId: templateParsed.data.templateId },
          { status: 404 }
        );
      }

      return NextResponse.json({ source }, { status: 201 });
    }

    // Otherwise create from full source definition
    const parsed = CreateDiscoverySourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const source = await createSource(
      { ...parsed.data, status: parsed.data.status ?? 'active', templateId: null },
      authResult.user.uid
    );

    return NextResponse.json({ source }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[Discovery Sources] POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}
