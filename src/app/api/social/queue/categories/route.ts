/**
 * Social Queue Content Categories API
 *
 * Operator-managed list of themed categories (e.g. "Tips", "Promotions") used
 * to organize the evergreen queue and drive the round-robin drip.
 *
 * GET    → list categories
 * POST   → add a category        { label }
 * PUT    → rename a category      { oldLabel, newLabel }  (re-tags queued posts)
 * DELETE → remove a category      { label }               (clears it from queued posts)
 *
 * Rate Limit: 100 req/min per organization
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AgentConfigService } from '@/lib/social/agent-config-service';
import { createPostingAgent } from '@/lib/social/autonomous-posting-agent';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/social/queue/categories';

const addSchema = z.object({
  label: z.string().trim().min(1, 'Category name is required').max(60, 'Category name is too long'),
});

const renameSchema = z.object({
  oldLabel: z.string().trim().min(1, 'Current category name is required'),
  newLabel: z.string().trim().min(1, 'New category name is required').max(60, 'Category name is too long'),
});

const removeSchema = z.object({
  label: z.string().trim().min(1, 'Category name is required'),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const categories = await AgentConfigService.getCategories();
    return NextResponse.json({ success: true, categories });
  } catch (error: unknown) {
    logger.error('Queue Categories API: GET failed', error instanceof Error ? error : new Error(String(error)), { route: ROUTE });
    return NextResponse.json({ success: false, error: 'Failed to load categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = addSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    try {
      const categories = await AgentConfigService.addCategory(validation.data.label, authResult.user.uid);
      logger.info('Queue Categories API: Category added', { label: validation.data.label });
      return NextResponse.json({ success: true, categories });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to add category' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    logger.error('Queue Categories API: POST failed', error instanceof Error ? error : new Error(String(error)), { route: ROUTE });
    return NextResponse.json({ success: false, error: 'Failed to add category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = renameSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { oldLabel, newLabel } = validation.data;

    try {
      const categories = await AgentConfigService.renameCategory(oldLabel, newLabel, authResult.user.uid);
      // Re-tag any queued posts that used the old label so nothing is orphaned.
      const agent = await createPostingAgent();
      const reassigned = await agent.reassignQueueCategory(oldLabel, newLabel);
      logger.info('Queue Categories API: Category renamed', { oldLabel, newLabel, reassigned });
      return NextResponse.json({ success: true, categories, reassigned });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to rename category' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    logger.error('Queue Categories API: PUT failed', error instanceof Error ? error : new Error(String(error)), { route: ROUTE });
    return NextResponse.json({ success: false, error: 'Failed to rename category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = removeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { label } = validation.data;

    try {
      const categories = await AgentConfigService.removeCategory(label, authResult.user.uid);
      // Posts that used this category become uncategorized (they still drain).
      const agent = await createPostingAgent();
      const cleared = await agent.reassignQueueCategory(label, null);
      logger.info('Queue Categories API: Category removed', { label, cleared });
      return NextResponse.json({ success: true, categories, cleared });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to remove category' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    logger.error('Queue Categories API: DELETE failed', error instanceof Error ? error : new Error(String(error)), { route: ROUTE });
    return NextResponse.json({ success: false, error: 'Failed to remove category' }, { status: 500 });
  }
}
