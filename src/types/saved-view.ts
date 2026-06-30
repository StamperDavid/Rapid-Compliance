/**
 * Saved / Filtered Views + Segmentation — shared types
 *
 * A SavedView is a named, reusable filter the operator builds over a CRM list
 * (contacts, companies, deals, leads). Views persist in Firestore and drive
 * REAL server-side filtering: selecting a view sends its id to the list route,
 * which loads the view and filters the records before returning them.
 *
 * This module is intentionally runtime-import-free (pure types + tiny unions)
 * so it can be imported by both server code (routes/services, which pull in the
 * Admin SDK) and client components (the filter bar / builder dialog) without
 * leaking the Admin SDK into the browser bundle.
 */

/** The four CRM objects that support saved views. */
export type SavedViewObject = 'contact' | 'company' | 'deal' | 'lead';

/** How a single condition compares a record's field against a target value. */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'exists'
  | 'not_exists';

/** Whether a record must match ALL conditions or ANY of them. */
export type MatchMode = 'all' | 'any';

/** A single "Where [field] [operator] [value]" clause. */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  /** Omitted for the `exists` / `not_exists` operators. */
  value?: string | number | boolean | string[];
}

/** Optional ordering applied client-side after filtering. */
export interface SavedViewSort {
  field: string;
  dir: 'asc' | 'desc';
}

/** A persisted, named view. */
export interface SavedView {
  id: string;
  object: SavedViewObject;
  name: string;
  filters: FilterCondition[];
  match: MatchMode;
  sort?: SavedViewSort;
  ownerId: string;
  /** When true the view is visible to every user, not just its owner. */
  shared?: boolean;
  /** ISO-8601 timestamps (kept as strings so they are JSON-serializable). */
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// UI helper types — describe the filterable fields a list page passes to the
// SavedViewsBar / FilterBuilderDialog so the builder can render the right
// inputs (a plain text box, a number box, a yes/no toggle, or a dropdown).
// ---------------------------------------------------------------------------

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterFieldDef {
  /** The record key this field maps to (supports dot paths, e.g. `address.city`). */
  value: string;
  /** Plain-English label shown in the dropdown. */
  label: string;
  /** Drives which value input the builder renders. Defaults to `text`. */
  type?: 'text' | 'number' | 'boolean' | 'select';
  /** For `type: 'select'` — the allowed values. */
  options?: FilterFieldOption[];
}
