/**
 * API Route: Webhook Configuration Management
 *
 * GET    /api/settings/webhooks - List configured webhooks
 * POST   /api/settings/webhooks - Create webhook
 * PUT    /api/settings/webhooks - Update webhook
 * DELETE /api/settings/webhooks - Delete webhook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

interface WebhookDoc {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  lastTriggered?: string;
  lastStatus?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const webhookPath = getSubCollection('webhooks');

const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional(),
});

const updateWebhookSchema = z.object({
  webhookId: z.string().min(1),
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  secret: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const webhooks = await FirestoreService.getAll<WebhookDoc>(
      webhookPath,
      [orderBy('createdAt', 'desc')]
    );

    return NextResponse.json({ success: true, webhooks });
  } catch (error: unknown) {
    logger.error('Failed to list webhooks', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = createWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, url, events, secret } = validation.data;
    const now = new Date();
    const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const webhook: WebhookDoc = {
      id: webhookId,
      name,
      url,
      events,
      active: true,
      secret,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.user.uid,
    };

    await FirestoreService.set(webhookPath, webhookId, webhook, false);

    logger.info('Webhook created', { webhookId, name });

    return NextResponse.json({ success: true, webhook });
  } catch (error: unknown) {
    logger.error('Failed to create webhook', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = updateWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { webhookId, ...updates } = validation.data;

    await FirestoreService.update(webhookPath, webhookId, {
      ...updates,
      updatedAt: new Date(),
    });

    logger.info('Webhook updated', { webhookId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to update webhook', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId');

    if (!webhookId) {
      return NextResponse.json(
        { success: false, error: 'webhookId is required' },
        { status: 400 }
      );
    }

    await FirestoreService.delete(webhookPath, webhookId);

    logger.info('Webhook deleted', { webhookId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete webhook', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
