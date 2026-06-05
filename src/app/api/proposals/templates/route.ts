import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface ProposalTemplateRecord {
  id: string;
  [key: string]: unknown;
}

const sectionSchema = z.object({
  id: z.string(),
  type: z.enum(['header', 'text', 'pricing_table', 'terms', 'signature', 'image']),
  content: z.string(),
  order: z.number(),
  editable: z.boolean().optional().default(true),
});

const variableSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'currency']),
  required: z.boolean().optional().default(false),
  defaultValue: z.union([z.string(), z.number()]).optional(),
});

const stylingSchema = z.object({
  primaryColor: z.string().optional(),
  logo: z.string().optional(),
  fontFamily: z.string().optional(),
});

const upsertTemplateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  type: z.enum(['proposal', 'quote', 'contract', 'invoice']).optional().default('proposal'),
  sections: z.array(sectionSchema).optional().default([]),
  variables: z.array(variableSchema).optional().default([]),
  styling: stylingSchema.optional().default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * GET /api/proposals/templates - List all proposal templates
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const templates = await AdminFirestoreService.getAll<ProposalTemplateRecord>(
      getSubCollection('proposalTemplates'),
      []
    );

    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch proposal templates';
    logger.error('Failed to fetch proposal templates', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/proposals/templates - Create or update a proposal template (upsert)
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

    const data = bodyResult.data;
    const templateId = data.id ?? `proposal-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const template = {
      ...data,
      id: templateId,
      createdAt: data.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    await AdminFirestoreService.set(getSubCollection('proposalTemplates'), templateId, template);

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save proposal template';
    logger.error('Failed to save proposal template', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
