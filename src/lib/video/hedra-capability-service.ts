/**
 * Hedra Capability Service — the live "deep knowledge of Hedra" layer.
 *
 * Our system is meant to be a Hedra SPECIALIST: it must know every model Hedra
 * offers, what each one is for, and exactly what inputs/controls it takes — and
 * stay current automatically as Hedra adds models. This service is that layer.
 *
 * It fetches Hedra's full live model catalog (GET /models) — at the time of
 * writing, 96 models across video + image, including OmniHuman 1.5 (full-body
 * character video), Kling v3/o3, Veo 3, Sora 2, and Hedra's own Character-3 —
 * structures it WITHOUT throwing anything away, caches it briefly, and exposes
 * typed query helpers + an agent-facing summary so the Hedra Specialist (and the
 * human UI) can pick the right model and drive its exact controls.
 *
 * This REPLACES the old `getHedraImageModelId` approach, which hand-picked one
 * text-to-image model and actively filtered out the reference/image-to-image
 * models — i.e. drove a Ferrari in first gear.
 *
 * @module video/hedra-capability-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app/public';
const FILE = 'hedra-capability-service.ts';
/** Catalog cache TTL — Hedra adds/changes models, so we refresh periodically. */
const CACHE_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// TYPES — a faithful, lossless model of Hedra's /models response
// ============================================================================

/** One input slot a model accepts (image/audio/video by role). */
export interface HedraInputSlot {
  /** Hedra-defined; commonly 'image' | 'audio' | 'video'. Kept open — Hedra owns the values. */
  type: string;
  role: string; // 'start_frame' | 'end_frame' | 'reference' | 'audio_input' | 'input_video' | ...
  required?: boolean;
  max_count?: number | null;
  max_file_size_bytes?: number | null;
  min_dimension_px?: number | null;
  max_dimension_px?: number | null;
  min_duration_ms?: number | null;
  max_duration_ms?: number | null;
  max_total_duration_ms?: number | null;
}

/** One input MODE (a model can expose e.g. a 'default' and a 'reference' mode). */
export interface HedraInputMode {
  mode: string;
  slots: HedraInputSlot[];
}

export interface HedraPriceDetails {
  credit_cost?: number;
  unit_scale?: number;
  billing_unit?: string;
}

/** A single Hedra model, all fields preserved from the live catalog. */
export interface HedraModel {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Hedra-defined; commonly 'video' | 'image'. Kept open — Hedra owns the values. */
  type: string;
  aspect_ratios: string[];
  aspect_ratio_range: unknown;
  resolutions: string[];
  durations: string[];
  requires_start_frame?: boolean;
  requires_end_frame?: boolean;
  requires_audio_input?: boolean;
  requires_input_video?: boolean;
  requires_character_orientation?: boolean;
  eta_ms?: number;
  tags: string[];
  max_duration_ms?: number | null;
  min_prompt_length?: number | null;
  max_prompt_length?: number | null;
  price_details?: HedraPriceDetails;
  pricing?: Record<string, unknown>;
  inputs: HedraInputMode[];
  premium?: boolean;
  logo_url?: string;
  display_order?: number | null;
}

interface CatalogCache {
  models: HedraModel[];
  fetchedAt: number;
}

// In-memory cache — object with mutable props (avoids require-atomic-updates).
const cache: { value: CatalogCache | null } = { value: null };

// ============================================================================
// FETCH + CACHE
// ============================================================================

async function getHedraApiKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Hedra API key not configured in Firestore (apiKeys → hedra).');
  }
  return key;
}

/**
 * Fetch the full live Hedra model catalog (cached for CACHE_TTL_MS). Returns the
 * complete, unfiltered list — every model, every field, every input mode/slot.
 */
export async function getHedraCatalog(force = false): Promise<HedraModel[]> {
  const now = Date.now();
  if (!force && cache.value && now - cache.value.fetchedAt < CACHE_TTL_MS) {
    return cache.value.models;
  }

  const key = await getHedraApiKey();
  const res = await fetch(`${HEDRA_BASE_URL}/models`, {
    headers: { 'x-api-key': key },
  });
  if (!res.ok) {
    throw new Error(`Hedra GET /models failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data: unknown = await res.json();
  const raw = Array.isArray(data) ? data : ((data as { data?: unknown[] }).data ?? []);
  const models = (raw as HedraModel[]).filter((m) => typeof m?.id === 'string' && typeof m?.slug === 'string');

  const fresh: CatalogCache = { models, fetchedAt: now };
  Object.assign(cache, { value: fresh });
  logger.info('[HedraCapability] Catalog refreshed', {
    total: models.length,
    video: models.filter((m) => m.type === 'video').length,
    image: models.filter((m) => m.type === 'image').length,
    file: FILE,
  });
  return models;
}

// ============================================================================
// QUERY HELPERS — what the Hedra Specialist + UI reason over
// ============================================================================

export async function getModelBySlug(slug: string): Promise<HedraModel | null> {
  return (await getHedraCatalog()).find((m) => m.slug === slug) ?? null;
}

export async function getModelById(id: string): Promise<HedraModel | null> {
  return (await getHedraCatalog()).find((m) => m.id === id) ?? null;
}

/** All roles this model can accept across every input mode (e.g. start_frame, reference). */
export function modelInputRoles(model: HedraModel): string[] {
  const roles = new Set<string>();
  for (const mode of model.inputs ?? []) {
    for (const slot of mode.slots ?? []) {
      roles.add(slot.role);
    }
  }
  return Array.from(roles);
}

/** True if the model accepts a reference image (character/style conditioning). */
export function acceptsReference(model: HedraModel): boolean {
  return modelInputRoles(model).includes('reference');
}

/** True if the model is a character-capable model (Hedra tags these `character`). */
export function isCharacterModel(model: HedraModel): boolean {
  return (model.tags ?? []).includes('character');
}

/** Max reference images this model accepts (0 if none). */
export function maxReferenceImages(model: HedraModel): number {
  let max = 0;
  for (const mode of model.inputs ?? []) {
    for (const slot of mode.slots ?? []) {
      if (slot.role === 'reference') {
        max = Math.max(max, slot.max_count ?? 1);
      }
    }
  }
  return max;
}

export interface CapabilityFilter {
  type?: 'video' | 'image';
  tag?: string;
  acceptsReference?: boolean;
  requiresStartFrame?: boolean;
  requiresAudio?: boolean;
  requiresInputVideo?: boolean;
  character?: boolean;
}

/** Filter the catalog by capability (e.g. video + character + accepts reference). */
export async function findModels(filter: CapabilityFilter): Promise<HedraModel[]> {
  const all = await getHedraCatalog();
  return all.filter((m) => {
    if (filter.type && m.type !== filter.type) { return false; }
    if (filter.tag && !(m.tags ?? []).includes(filter.tag)) { return false; }
    if (filter.character && !isCharacterModel(m)) { return false; }
    if (filter.acceptsReference && !acceptsReference(m)) { return false; }
    if (filter.requiresStartFrame && !m.requires_start_frame) { return false; }
    if (filter.requiresAudio && !m.requires_audio_input) { return false; }
    if (filter.requiresInputVideo && !m.requires_input_video) { return false; }
    return true;
  });
}

/**
 * Render a one-line capability summary for a model — used to build the Hedra
 * Specialist's knowledge block so it reasons over the real, current catalog
 * instead of hardcoded assumptions.
 */
export function describeModel(model: HedraModel): string {
  const caps: string[] = [];
  if (model.requires_start_frame) { caps.push('needs start-frame image'); }
  if (model.requires_end_frame) { caps.push('needs end-frame image'); }
  if (model.requires_audio_input) { caps.push('needs audio'); }
  if (model.requires_input_video) { caps.push('needs input video'); }
  if (model.requires_character_orientation) { caps.push('character-orientation'); }
  const refs = maxReferenceImages(model);
  if (refs > 0) { caps.push(`up to ${refs} reference image(s)`); }
  const dur = model.max_duration_ms ? `${Math.round(model.max_duration_ms / 1000)}s max` : '';
  const ar = (model.aspect_ratios ?? []).join('/');
  return [
    `${model.slug} (${model.type}${model.tags?.length ? `, ${model.tags.join(',')}` : ''})`,
    model.description,
    [caps.join('; '), ar, dur].filter(Boolean).join(' | '),
  ].filter(Boolean).join(' — ');
}

/** A full agent-facing catalog summary the Hedra Specialist can carry as knowledge. */
export async function describeCatalogForAgent(): Promise<string> {
  const all = await getHedraCatalog();
  const byType = (t: string): string =>
    all.filter((m) => m.type === t).map((m) => `- ${describeModel(m)}`).join('\n');
  return [
    `HEDRA MODEL CATALOG (${all.length} models, live).`,
    `\n## VIDEO MODELS\n${byType('video')}`,
    `\n## IMAGE MODELS\n${byType('image')}`,
  ].join('\n');
}
