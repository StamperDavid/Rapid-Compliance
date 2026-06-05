import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const routingRulesPath = getSubCollection('leadRoutingRules');

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().optional(),
  routingType: z.enum(['round-robin', 'territory', 'skill-based', 'load-balance', 'custom']).optional(),
  assignedUsers: z.array(z.string()).optional(),
  conditions: z.array(conditionSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/settings/lead-routing/[id] - Update a routing rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateRuleSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    await AdminFirestoreService.update(routingRulesPath, id, {
      ...bodyResult.data,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update routing rule';
    logger.error('Failed to update routing rule', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/lead-routing/[id]/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/lead-routing/[id] - Delete a routing rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await AdminFirestoreService.delete(routingRulesPath, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete routing rule';
    logger.error('Failed to delete routing rule', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/lead-routing/[id]/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
