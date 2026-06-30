/**
 * Saved Views Service
 *
 * CRUD for SavedView documents plus the request-filter resolver used by the
 * CRM list routes. Storage is the `savedViews` platform sub-collection
 * (penthouse model — path built via getSubCollection, never a hardcoded
 * PLATFORM_ID). Server-side only: uses the Admin SDK.
 */

import { z } from 'zod';
import { where } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  SavedView,
  SavedViewObject,
  FilterCondition,
  MatchMode,
  SavedViewSort,
} from '@/types/saved-view';

const collectionPath = (): string => getSubCollection('savedViews');

// ---------------------------------------------------------------------------
// Zod schemas — exported so the API routes validate with the same definitions.
// ---------------------------------------------------------------------------

export const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'exists',
  'not_exists',
]);

export const filterConditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: filterOperatorSchema,
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});

export const filterConditionsSchema = z.array(filterConditionSchema);
export const matchModeSchema = z.enum(['all', 'any']);
export const savedViewObjectSchema = z.enum(['contact', 'company', 'deal', 'lead']);
export const savedViewSortSchema = z.object({
  field: z.string().min(1),
  dir: z.enum(['asc', 'desc']),
});

export interface CreateSavedViewInput {
  object: SavedViewObject;
  name: string;
  filters: FilterCondition[];
  match: MatchMode;
  sort?: SavedViewSort;
  ownerId: string;
  shared?: boolean;
}

export interface UpdateSavedViewInput {
  name?: string;
  filters?: FilterCondition[];
  match?: MatchMode;
  sort?: SavedViewSort;
  shared?: boolean;
}

/**
 * List the views for an object that the requesting user can see: their own
 * views plus any shared views. Sorted newest-first by creation time.
 */
export async function listSavedViews(
  object: SavedViewObject,
  requesterId: string
): Promise<SavedView[]> {
  try {
    const all = await AdminFirestoreService.getAll<SavedView>(collectionPath(), [
      where('object', '==', object),
    ]);

    const visible = all.filter(
      (view) => view.ownerId === requesterId || view.shared === true
    );

    visible.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return visible;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list saved views', error instanceof Error ? error : undefined, { object });
    throw new Error(`Failed to list saved views: ${message}`);
  }
}

export async function getSavedView(viewId: string): Promise<SavedView | null> {
  try {
    return await AdminFirestoreService.get<SavedView>(collectionPath(), viewId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get saved view', error instanceof Error ? error : undefined, { viewId });
    throw new Error(`Failed to get saved view: ${message}`);
  }
}

export async function createSavedView(input: CreateSavedViewInput): Promise<SavedView> {
  try {
    const id = `view-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const view: SavedView = {
      id,
      object: input.object,
      name: input.name,
      filters: input.filters,
      match: input.match,
      ...(input.sort ? { sort: input.sort } : {}),
      ownerId: input.ownerId,
      shared: input.shared ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(collectionPath(), id, view, false);

    logger.info('Saved view created', { id, object: input.object, conditions: input.filters.length });
    return view;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create saved view', error instanceof Error ? error : undefined, { object: input.object });
    throw new Error(`Failed to create saved view: ${message}`);
  }
}

export async function updateSavedView(
  viewId: string,
  updates: UpdateSavedViewInput
): Promise<SavedView | null> {
  try {
    const existing = await getSavedView(viewId);
    if (!existing) {
      return null;
    }

    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) { data.name = updates.name; }
    if (updates.filters !== undefined) { data.filters = updates.filters; }
    if (updates.match !== undefined) { data.match = updates.match; }
    if (updates.shared !== undefined) { data.shared = updates.shared; }
    if (updates.sort !== undefined) { data.sort = updates.sort; }

    await AdminFirestoreService.update(collectionPath(), viewId, data);

    logger.info('Saved view updated', { viewId, updatedFields: Object.keys(data) });
    return await getSavedView(viewId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update saved view', error instanceof Error ? error : undefined, { viewId });
    throw new Error(`Failed to update saved view: ${message}`);
  }
}

export async function deleteSavedView(viewId: string): Promise<boolean> {
  try {
    const existing = await getSavedView(viewId);
    if (!existing) {
      return false;
    }
    await AdminFirestoreService.delete(collectionPath(), viewId);
    logger.info('Saved view deleted', { viewId });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete saved view', error instanceof Error ? error : undefined, { viewId });
    throw new Error(`Failed to delete saved view: ${message}`);
  }
}

/**
 * Resolve the filter set a list route should apply, given its query params.
 * Precedence: an explicit `viewId` (loaded from Firestore) wins over an inline
 * `filters` JSON param. Returns null when neither yields usable filters (the
 * route then returns its normal, unfiltered page).
 *
 * Throws on malformed inline JSON / invalid conditions so the route can answer
 * 400 rather than silently ignoring a broken filter.
 */
export async function resolveRequestFilters(opts: {
  viewId?: string;
  filtersJson?: string;
  match?: string;
}): Promise<{ filters: FilterCondition[]; match: MatchMode } | null> {
  if (opts.viewId) {
    const view = await getSavedView(opts.viewId);
    if (!view) {
      logger.warn('Saved view not found while resolving filters', { viewId: opts.viewId });
      return null;
    }
    return { filters: view.filters, match: view.match };
  }

  if (opts.filtersJson) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(opts.filtersJson);
    } catch {
      throw new Error('Invalid filters JSON');
    }
    const filters = filterConditionsSchema.parse(parsedJson);
    const match: MatchMode = opts.match === 'any' ? 'any' : 'all';
    return { filters, match };
  }

  return null;
}
