/**
 * POST /api/content/shot-plan/edit-field
 *
 * Thin route powering the "Ask AI" per-field edit. Two-stage, both delegated:
 *   1. `editShotPlanField(...)` — the surgical specialist regenerates ONLY the
 *      requested field's value from the operator instruction (Standing Rule #2:
 *      never re-rolls the plan, never edits the GM).
 *   2. `applyShotPlanEditDetailed(plan, edit)` — applies that single value
 *      immutably, re-validating with `ShotPlanSchema`, and reports which
 *      downstream shots got flagged `upstreamChanged`.
 *
 * Returns the updated ShotPlan + the flagged downstream shot ids so the UI can
 * surface "may need review" badges. No business logic in the route — it
 * authenticates, validates, delegates, and maps errors to HTTP.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { editShotPlanField } from '@/lib/agents/content/shot-plan/planner';
import {
  applyShotPlanEditDetailed,
  type ShotPlanEdit,
} from '@/lib/video/shot-plan-edit';
import {
  ShotPlanSchema,
  ShotPlanStatusSchema,
  type ShotPlanSharedChoices,
  type ShotPlanShot,
} from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/edit-field/route.ts';

const BodySchema = z
  .object({
    plan: ShotPlanSchema,
    target: z.enum(['shared', 'shot', 'plan']),
    shotId: z.string().trim().min(1).optional(),
    field: z.string().trim().min(1),
    instruction: z.string().trim().min(1, 'Tell me what to change').max(2000),
  })
  .refine((b) => b.target !== 'shot' || Boolean(b.shotId), {
    message: 'shotId is required when target is "shot"',
    path: ['shotId'],
  });

/**
 * Build the typed `ShotPlanEdit` descriptor for the resolved value. The union
 * field/value types are narrowed by `target`; the resulting plan is re-validated
 * by `applyShotPlanEditDetailed` against `ShotPlanSchema`, so a bad value is
 * rejected rather than persisted.
 */
function buildEdit(
  target: 'shared' | 'shot' | 'plan',
  field: string,
  value: unknown,
  shotId?: string,
): ShotPlanEdit {
  if (target === 'shared') {
    return {
      target: 'shared',
      field: field as keyof ShotPlanSharedChoices,
      value: value as ShotPlanSharedChoices[keyof ShotPlanSharedChoices],
    };
  }
  if (target === 'plan') {
    if (field === 'status') {
      // Coerce to a valid status; schema re-validate rejects anything else.
      const status = ShotPlanStatusSchema.catch('draft').parse(value);
      return { target: 'plan', field: 'status', value: status };
    }
    // Only title/status are editable plan-level fields.
    return { target: 'plan', field: 'title', value: String(value) };
  }
  return {
    target: 'shot',
    shotId: shotId ?? '',
    field: field as keyof ShotPlanShot,
    value: value as ShotPlanShot[keyof ShotPlanShot],
  };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // 1. Surgical specialist regenerates ONLY the requested field's value.
    const newValue = await editShotPlanField({
      plan: body.plan,
      target: body.target,
      ...(body.shotId ? { shotId: body.shotId } : {}),
      field: body.field,
      instruction: body.instruction,
      userId: user.uid,
    });

    // 2. Apply the single value immutably; re-validates + flags downstream shots.
    const edit = buildEdit(body.target, body.field, newValue, body.shotId);
    const result = applyShotPlanEditDetailed(body.plan, edit);

    logger.info('[shot-plan/edit-field] field edited', {
      file: FILE,
      target: body.target,
      field: body.field,
      changed: result.changed,
      flagged: result.flaggedDownstreamShotIds.length,
    });

    return NextResponse.json({
      success: true,
      plan: result.plan,
      changed: result.changed,
      flaggedDownstreamShotIds: result.flaggedDownstreamShotIds,
    });
  } catch (error) {
    logger.error(
      'Shot Plan field edit failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot Plan field edit failed',
      },
      { status: 500 },
    );
  }
}
