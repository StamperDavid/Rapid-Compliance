/**
 * API Route: Social Training - Knowledge Base
 *
 * GET    /api/social/training/knowledge → List knowledge items
 * POST   /api/social/training/knowledge → Upload a knowledge document
 * DELETE /api/social/training/knowledge?id={id} → Remove a knowledge item
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const KNOWLEDGE_COLLECTION = getSubCollection('socialKnowledge');

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
  type: z.enum(['document', 'example', 'template']),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training/knowledge');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const result = await FirestoreService.getAllPaginated(
      KNOWLEDGE_COLLECTION,
      [orderBy('uploadedAt', 'desc')],
      100
    );

    return NextResponse.json({
      success: true,
      items: result.data ?? [],
      total: (result.data ?? []).length,
    });
  } catch (error: unknown) {
    logger.error('Knowledge API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load knowledge items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training/knowledge');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = uploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const itemId = `knowledge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const item = {
      id: itemId,
      ...validation.data,
      uploadedAt: new Date().toISOString(),
      uploadedBy: authResult.user.uid,
    };

    await FirestoreService.set(KNOWLEDGE_COLLECTION, itemId, item, false);

    logger.info('Knowledge API: Item uploaded', { itemId, type: validation.data.type });

    return NextResponse.json({ success: true, item });
  } catch (error: unknown) {
    logger.error('Knowledge API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to upload knowledge item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training/knowledge');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required (pass as ?id=)' },
        { status: 400 }
      );
    }

    await FirestoreService.delete(KNOWLEDGE_COLLECTION, itemId);

    logger.info('Knowledge API: Item deleted', { itemId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Knowledge API: DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to delete knowledge item' },
      { status: 500 }
    );
  }
}
