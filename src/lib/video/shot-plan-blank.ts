/**
 * Shot Plan blank-state + builder helpers (ADDITIVE, pure, client-safe).
 *
 * Used by the "Start blank / fill manually" entry and the per-shot add action so
 * the UI never has to hand-assemble a contract-shaped object. All functions are
 * pure and produce contract-valid pieces (validated by `ShotPlanSchema` once the
 * surrounding edits are applied through `applyShotPlanEdit`).
 */

import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanCastMember,
} from '@/types/shot-plan';

function isoNow(): string {
  return new Date().toISOString();
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** A stable-ish shot id matching the planner's `shot_<n>_<rand>` shape. */
export function makeShotId(index: number): string {
  return `shot_${index + 1}_${randomSuffix()}`;
}

/** A blank, contract-valid shot at a given index. */
export function makeBlankShot(index: number): ShotPlanShot {
  return {
    id: makeShotId(index),
    index,
    title: '',
    action: '',
    castMemberIds: [],
    environment: '',
    camera: {},
    durationSeconds: 5,
    transitionIn: index === 0 ? 'cut' : 'continue',
  };
}

/** A blank, contract-valid plan with a single empty shot, ready to fill manually. */
export function makeBlankShotPlan(title?: string): ShotPlan {
  const now = isoNow();
  return {
    id: `splan_${Date.now()}_${randomSuffix()}`,
    title: title?.trim() ? title.trim() : 'Untitled Shot Plan',
    sharedChoices: {
      cutCount: 1,
      colorPalette: [],
      environmentFingerprint: '',
      cast: [],
      moodKeywords: [],
      cinematographyNotes: [],
    },
    shots: [makeBlankShot(0)],
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

/** Minimal AvatarProfile-ish shape the picker hands back for cast resolution. */
export interface CastSourceProfile {
  id: string;
  name: string;
  role?: string | null;
  frontalImageUrl?: string | null;
  additionalImageUrls?: string[];
  fullBodyImageUrl?: string | null;
  upperBodyImageUrl?: string | null;
}

/** True for an absolute http(s) URL — the only shape `ShotPlanSchema` accepts. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Build a contract-valid cast member from a picked avatar profile. */
export function castMemberFromProfile(profile: CastSourceProfile): ShotPlanCastMember {
  const urls = [
    profile.frontalImageUrl,
    profile.fullBodyImageUrl,
    profile.upperBodyImageUrl,
    ...(profile.additionalImageUrls ?? []),
  ].filter((u): u is string => typeof u === 'string' && isHttpUrl(u.trim()));

  return {
    characterId: profile.id,
    name: profile.name,
    // De-dupe, preserve order, cap at the contract max (20). Only absolute
    // http(s) urls survive — that's all the contract accepts.
    referenceImageUrls: Array.from(new Set(urls.map((u) => u.trim()))).slice(0, 20),
    ...(profile.role ? { role: profile.role } : {}),
  };
}
