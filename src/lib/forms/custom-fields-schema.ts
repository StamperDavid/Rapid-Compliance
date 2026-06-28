/**
 * Custom Fields — schema helpers
 *
 * Shared client-side helpers for working with operator-defined custom fields
 * on the four core CRM objects. Custom fields live inside the generic schema
 * engine (`platforms/{platformId}/schemas`) alongside the standard fields; a
 * field is "custom" when its `key` is not part of the seeded standard schema
 * for that object.
 *
 * Reuses `STANDARD_SCHEMAS` from the schema engine — does NOT fork a parallel
 * field-definition system.
 *
 * @module lib/forms/custom-fields-schema
 */

import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import type { CustomFieldDef } from '@/lib/forms/custom-field-renderer';

/** The four core CRM objects that support custom fields, mapped to their schema id. */
export const CUSTOM_FIELD_OBJECTS = {
  contacts: 'contacts',
  companies: 'companies',
  deals: 'deals',
  leads: 'leads',
} as const;

export type CustomFieldObjectKey = keyof typeof CUSTOM_FIELD_OBJECTS;

/** A schema field as returned by the schema engine / standard schemas. */
export interface RawSchemaField {
  id?: string;
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string[];
  description?: string;
  isCustom?: boolean;
}

/** A schema document (subset we care about). */
export interface RawSchema {
  id: string;
  name?: string;
  fields?: RawSchemaField[];
}

/**
 * Set of standard field keys for a given object — anything not in here is custom.
 */
export function getStandardFieldKeys(objectKey: CustomFieldObjectKey): Set<string> {
  const standard = STANDARD_SCHEMAS[objectKey];
  const keys = (standard?.fields ?? [])
    .map((f) => f.key)
    .filter((k): k is string => typeof k === 'string');
  return new Set(keys);
}

/**
 * Normalise a raw schema field into a `CustomFieldDef`. Returns null if it lacks a key.
 */
function toCustomFieldDef(field: RawSchemaField): CustomFieldDef | null {
  if (!field.key) {
    return null;
  }
  return {
    key: field.key,
    label: field.label ?? field.key,
    type: field.type ?? 'text',
    required: field.required ?? false,
    options: field.options,
    description: field.description,
  };
}

/**
 * Given a schema (from `/api/schemas/<object>`), return ONLY the custom fields
 * — those whose key is not part of the standard schema, or that are explicitly
 * flagged `isCustom`.
 */
export function extractCustomFields(
  objectKey: CustomFieldObjectKey,
  schema: RawSchema | null | undefined
): CustomFieldDef[] {
  if (!schema?.fields) {
    return [];
  }
  const standardKeys = getStandardFieldKeys(objectKey);
  return schema.fields
    .filter((f) => f.key != null && (f.isCustom === true || !standardKeys.has(f.key)))
    .map(toCustomFieldDef)
    .filter((f): f is CustomFieldDef => f !== null);
}

/**
 * Fetch an object's schema and return its custom fields. Returns [] when the
 * schema has not been created in Firestore yet (404) — standard schemas are
 * only persisted once edited, and a fresh standard schema has no custom fields.
 *
 * @param objectKey  one of the four CRM objects
 * @param authFetch  the auth-aware fetch from `useAuthFetch`
 */
export async function loadCustomFields(
  objectKey: CustomFieldObjectKey,
  authFetch: (url: string, options?: RequestInit) => Promise<Response>
): Promise<CustomFieldDef[]> {
  const schemaId = CUSTOM_FIELD_OBJECTS[objectKey];
  const res = await authFetch(`/api/schemas/${schemaId}`);
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { success?: boolean; schema?: RawSchema };
  if (!json.success || !json.schema) {
    return [];
  }
  return extractCustomFields(objectKey, json.schema);
}
