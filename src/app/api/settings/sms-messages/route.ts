import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const smsTemplatesPath = getSubCollection('smsTemplates');

interface SmsTemplate {
  id: string;
  name?: string;
  message: string;
  trigger?: string;
  isCustom?: boolean;
}

const upsertTemplateSchema = z.object({
  id: z.string().min(1, 'Template id is required'),
  name: z.string().optional(),
  message: z.string(),
  trigger: z.string().optional(),
  isCustom: z.boolean().optional(),
  /** When false, the doc is written fresh (no merge); defaults to merge. */
  merge: z.boolean().optional(),
});

/**
 * GET /api/settings/sms-messages - List all SMS templates
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const templates = await AdminFirestoreService.getAll<SmsTemplate>(smsTemplatesPath);

    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch SMS templates';
    logger.error('Failed to fetch SMS templates', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/sms-messages/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/sms-messages - Upsert an SMS template
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

    const { merge = true, ...template } = bodyResult.data;

    await AdminFirestoreService.set(
      smsTemplatesPath,
      template.id,
      {
        ...template,
        updatedAt: new Date().toISOString(),
      },
      merge
    );

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save SMS template';
    logger.error('Failed to save SMS template', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/sms-messages/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
