/**
 * Email Builder Templates API
 *
 * POST /api/email/templates — save a builder template (block-array shape) to Firestore
 * GET  /api/email/templates — list saved builder templates for the platform
 *
 * Distinct from the HTML-body `emailTemplates` collection managed by
 * `src/lib/email/email-template-service.ts`. Block-array (drag-drop builder)
 * templates live in `emailBuilderTemplates` so the editor can load them back
 * into the block model on edit.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const emailBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['header', 'text', 'image', 'button', 'divider', 'social', 'footer']),
  content: z.string(),
  styling: z
    .object({
      alignment: z.enum(['left', 'center', 'right']).optional(),
      padding: z.string().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      fontSize: z.string().optional(),
      buttonColor: z.string().optional(),
      buttonTextColor: z.string().optional(),
      buttonUrl: z.string().optional(),
    })
    .optional(),
  order: z.number(),
});

const emailVariableSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  defaultValue: z.string().max(500).optional(),
  source: z.enum(['lead', 'contact', 'deal', 'custom']).optional(),
  sourceField: z.string().max(120).optional(),
});

const emailTemplateSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1, 'Template name is required').max(200),
  subject: z.string().max(500),
  preheader: z.string().max(500).optional(),
  blocks: z.array(emailBlockSchema),
  variables: z.array(emailVariableSchema),
  styling: z.object({
    backgroundColor: z.string().max(50).optional(),
    primaryColor: z.string().max(50).optional(),
    fontFamily: z.string().max(200).optional(),
    headerImage: z.string().max(2000).optional(),
  }),
  category: z.string().max(80).optional(),
  isDefault: z.boolean().optional(),
});

const COLLECTION_NAME = 'emailBuilderTemplates';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    if (!adminDal) {
      logger.error('Email template save failed — admin DAL not initialized', undefined, {
        route: '/api/email/templates',
        method: 'POST',
      });
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const rawBody: unknown = await req.json();
    const parsed = emailTemplateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid template data', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const incoming = parsed.data;
    const templateId =
      typeof incoming.id === 'string' && incoming.id.length > 0
        ? incoming.id
        : `email-template-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const collectionRef = adminDal.getPlatformCollection(COLLECTION_NAME);
    const docRef = collectionRef.doc(templateId);

    const existing = await docRef.get();
    const isNew = !existing.exists;

    const payload = {
      ...incoming,
      id: templateId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      ...(isNew
        ? {
            createdAt: FieldValue.serverTimestamp(),
            createdBy: user.uid,
          }
        : {}),
    };

    await docRef.set(payload, { merge: true });

    const saved = await docRef.get();
    logger.info('Email builder template saved', {
      templateId,
      name: incoming.name,
      blocks: incoming.blocks.length,
      isNew,
    });

    return NextResponse.json({
      success: true,
      template: saved.data(),
      isNew,
    });
  } catch (error: unknown) {
    logger.error(
      'Email template save error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/email/templates', method: 'POST' },
    );
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const collectionRef = adminDal.getPlatformCollection(COLLECTION_NAME);
    const snapshot = await collectionRef.orderBy('updatedAt', 'desc').limit(100).get();

    const templates = snapshot.docs.map(d => d.data());

    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    logger.error(
      'Email template list error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/email/templates', method: 'GET' },
    );
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}
