import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import type { RoutingRule } from '@/lib/crm/lead-routing';

export const dynamic = 'force-dynamic';

const routingRulesPath = getSubCollection('leadRoutingRules');

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});

const metadataSchema = z.object({
  territories: z.array(z.object({
    userId: z.string(),
    states: z.array(z.string()).optional(),
    zipcodes: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
  })).optional(),
  skills: z.array(z.object({
    userId: z.string(),
    skills: z.array(z.string()),
  })).optional(),
  maxLeadsPerUser: z.number().optional(),
  balancingPeriod: z.enum(['day', 'week', 'month']).optional(),
}).optional();

const createRuleSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Rule name is required'),
  enabled: z.boolean().optional(),
  priority: z.number(),
  routingType: z.enum(['round-robin', 'territory', 'skill-based', 'load-balance', 'custom']),
  assignedUsers: z.array(z.string()).optional(),
  conditions: z.array(conditionSchema).optional(),
  metadata: metadataSchema,
});

/**
 * GET /api/settings/lead-routing - List all routing rules
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rules = await AdminFirestoreService.getAll<RoutingRule>(routingRulesPath);

    return NextResponse.json({ success: true, rules });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch routing rules';
    logger.error('Failed to fetch routing rules', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/lead-routing/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/lead-routing - Create a routing rule
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createRuleSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const ruleId = bodyResult.data.id ?? `rule-${Date.now()}`;
    const { id: _ignored, ...rest } = bodyResult.data;

    const rule = {
      ...rest,
      id: ruleId,
      enabled: rest.enabled ?? true,
      assignedUsers: rest.assignedUsers ?? [],
      createdAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(routingRulesPath, ruleId, rule, false);

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create routing rule';
    logger.error('Failed to create routing rule', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/lead-routing/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
