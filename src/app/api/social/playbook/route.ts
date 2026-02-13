/**
 * API Route: Golden Playbook Management
 *
 * GET  /api/social/playbook  → Get active playbook or list all versions
 * POST /api/social/playbook  → Create a new playbook from current config
 * PUT  /api/social/playbook  → Deploy a specific playbook version
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const deploySchema = z.object({
  playbookId: z.string().min(1),
  action: z.literal('deploy'),
});

const createSchema = z.object({
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const listAll = searchParams.get('all') === 'true';

    const { getActivePlaybook, getAllPlaybooks } = await import('@/lib/social/golden-playbook-builder');

    if (listAll) {
      const playbooks = await getAllPlaybooks();
      return NextResponse.json({ success: true, playbooks, total: playbooks.length });
    }

    const activePlaybook = await getActivePlaybook();
    return NextResponse.json({
      success: true,
      playbook: activePlaybook,
      hasPlaybook: activePlaybook !== null,
    });
  } catch (error: unknown) {
    logger.error('Playbook API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to get playbook' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = createSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { createPlaybook, savePlaybook } = await import('@/lib/social/golden-playbook-builder');

    const playbook = await createPlaybook({
      userId: authResult.user.uid,
      notes: validation.data.notes,
    });

    await savePlaybook(playbook);

    logger.info('Playbook API: New playbook created', {
      playbookId: playbook.id,
      version: playbook.version,
    });

    return NextResponse.json({ success: true, playbook });
  } catch (error: unknown) {
    logger.error('Playbook API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to create playbook' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = deploySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { deployPlaybook } = await import('@/lib/social/golden-playbook-builder');

    await deployPlaybook(validation.data.playbookId);

    logger.info('Playbook API: Playbook deployed', {
      playbookId: validation.data.playbookId,
      deployedBy: authResult.user.uid,
    });

    return NextResponse.json({ success: true, deployed: true });
  } catch (error: unknown) {
    logger.error('Playbook API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to deploy playbook' },
      { status: 500 }
    );
  }
}
