/**
 * Shot Plan surgical-edit helper (ADDITIVE, pure functions).
 *
 * Powers BOTH manual operator edits AND scoped AI edits: change exactly ONE field
 * of a Shot Plan and return a NEW plan with only that field changed — never a
 * whole-plan re-roll. When a SHOT field that could affect later shots changes, the
 * downstream shots get their `upstreamChanged` flag set (Mission-Control-style), so
 * the operator can choose to rerun them or explicitly keep their output.
 *
 * All functions are immutable: the input plan is never mutated; a fresh plan
 * (with a bumped `updatedAt`) is returned.
 */

import {
  ShotPlanSchema,
  type ShotPlan,
  type ShotPlanShot,
  type ShotPlanSharedChoices,
} from '@/types/shot-plan';

// ============================================================================
// Edit descriptor
// ============================================================================

/** Which level the edit targets. */
export type ShotPlanEditTarget = 'shared' | 'shot' | 'plan';

/**
 * A single, path-addressable field edit.
 *  - `target: 'shared'` — edits a `ShotPlanSharedChoices` field (no `shotId`).
 *  - `target: 'shot'`   — edits a `ShotPlanShot` field (`shotId` required).
 *  - `target: 'plan'`   — edits a top-level plan field (`title` / `status`).
 *
 * `field` is the property name on the targeted object; `value` is its new value.
 * The result is re-validated with `ShotPlanSchema`, so an out-of-contract value
 * is rejected rather than silently corrupting the plan.
 */
export type ShotPlanEdit =
  | {
      target: 'shared';
      field: keyof ShotPlanSharedChoices;
      value: ShotPlanSharedChoices[keyof ShotPlanSharedChoices];
    }
  | {
      target: 'shot';
      shotId: string;
      field: keyof ShotPlanShot;
      value: ShotPlanShot[keyof ShotPlanShot];
    }
  | {
      target: 'plan';
      field: 'title';
      value: ShotPlan['title'];
    }
  | {
      target: 'plan';
      field: 'status';
      value: ShotPlan['status'];
    }
  | {
      target: 'plan';
      field: 'floorPlan';
      value: ShotPlan['floorPlan'];
    };

/** The outcome of applying an edit. */
export interface ShotPlanEditResult {
  plan: ShotPlan;
  /** Whether the edit actually changed anything (false when the value matched). */
  changed: boolean;
  /** Ids of downstream shots newly flagged `upstreamChanged` by this edit. */
  flaggedDownstreamShotIds: string[];
}

// ============================================================================
// Which shot fields ripple downstream
// ============================================================================

/**
 * Shot fields whose change can affect LATER shots (continuity, identity, world,
 * look). Editing one of these flags downstream shots. Fields that are purely local
 * to the shot (`title`, `dialogue`, `durationSeconds`, `generated`, `upstreamChanged`,
 * `assembledPrompt`) do NOT ripple.
 */
const DOWNSTREAM_AFFECTING_SHOT_FIELDS: ReadonlySet<keyof ShotPlanShot> = new Set([
  'action',
  'castMemberIds',
  'environment',
  'camera',
  'lighting',
  'mood',
  'transitionIn',
  'index',
]);

// ============================================================================
// Apply
// ============================================================================

/**
 * Apply a single surgical edit, returning a new plan. Throws if the edit targets a
 * missing shot or produces an out-of-contract plan (caught by `ShotPlanSchema`).
 */
export function applyShotPlanEdit(plan: ShotPlan, edit: ShotPlanEdit): ShotPlan {
  return applyShotPlanEditDetailed(plan, edit).plan;
}

/**
 * Apply a single surgical edit and return the full result (plan + change/flag
 * metadata). Prefer this when the caller needs to know what rippled.
 */
export function applyShotPlanEditDetailed(
  plan: ShotPlan,
  edit: ShotPlanEdit,
): ShotPlanEditResult {
  const now = new Date().toISOString();
  let changed = false;
  const flaggedDownstreamShotIds: string[] = [];

  let next: ShotPlan;

  if (edit.target === 'plan') {
    if (Object.is(plan[edit.field], edit.value)) {
      next = plan;
    } else {
      changed = true;
      next = { ...plan, [edit.field]: edit.value };
    }
  } else if (edit.target === 'shared') {
    const current = plan.sharedChoices[edit.field];
    if (deepEqual(current, edit.value)) {
      next = plan;
    } else {
      changed = true;
      next = {
        ...plan,
        sharedChoices: { ...plan.sharedChoices, [edit.field]: edit.value },
      };
    }
  } else {
    // target === 'shot'
    const targetIndex = plan.shots.findIndex((s) => s.id === edit.shotId);
    if (targetIndex === -1) {
      throw new Error(`applyShotPlanEdit: shot not found: ${edit.shotId}`);
    }

    const targetShot = plan.shots[targetIndex];
    if (deepEqual(targetShot[edit.field], edit.value)) {
      next = plan;
    } else {
      changed = true;
      const ripples = DOWNSTREAM_AFFECTING_SHOT_FIELDS.has(edit.field);
      const editedShotOrder = targetShot.index;

      const shots: ShotPlanShot[] = plan.shots.map((s) => {
        if (s.id === edit.shotId) {
          return { ...s, [edit.field]: edit.value };
        }
        if (ripples && s.index > editedShotOrder && !s.upstreamChanged) {
          flaggedDownstreamShotIds.push(s.id);
          return { ...s, upstreamChanged: true };
        }
        return s;
      });

      next = { ...plan, shots };
    }
  }

  if (!changed) {
    return { plan, changed: false, flaggedDownstreamShotIds: [] };
  }

  next = { ...next, updatedAt: now };

  // Re-validate: an out-of-contract value must be rejected, not persisted.
  const parsed = ShotPlanSchema.safeParse(next);
  if (!parsed.success) {
    throw new Error(
      `applyShotPlanEdit: edit produced an invalid plan — ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return { plan: parsed.data, changed: true, flaggedDownstreamShotIds };
}

/**
 * Clear the `upstreamChanged` flag on a shot — the operator's "Still good — keep
 * this output" action. Returns a new plan (or the same plan when nothing changed).
 */
export function clearUpstreamChanged(plan: ShotPlan, shotId: string): ShotPlan {
  const target = plan.shots.find((s) => s.id === shotId);
  if (!target?.upstreamChanged) {
    return plan;
  }
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    shots: plan.shots.map((s) =>
      s.id === shotId ? { ...s, upstreamChanged: false } : s,
    ),
  };
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Structural equality for edit-value comparison. Handles the JSON-shaped values a
 * Shot Plan field can hold (primitives, arrays, plain objects) — enough to decide
 * whether an edit is a no-op without pulling in a dependency.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}
