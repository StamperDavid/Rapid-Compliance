'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionTitle } from '@/components/ui/typography';
import { RecordActivityTimeline } from '@/components/crm/RecordActivityTimeline';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

// Dynamic record values stored on a custom-object record.
type RecordValue = string | number | boolean | string[] | null;

interface EntityRecord {
  id: string;
  [key: string]: RecordValue | undefined;
}

interface SchemaField {
  id: string;
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
  config?: { linkedSchema?: string };
  lookupEntity?: string;
}

interface ApiSchema {
  id?: string;
  name?: string;
  pluralName?: string;
  singularName?: string;
  icon?: string;
  primaryFieldId?: string;
  fields?: SchemaField[];
}

interface SchemaResponse {
  schemas?: ApiSchema[];
}

/** Core objects that have bespoke detail pages — lookups to these route to those pages. */
const CORE_OBJECT_ROUTES: Record<string, string> = {
  contacts: '/contacts',
  companies: '/companies',
  deals: '/deals',
  leads: '/leads',
};

/** Best-effort display name for any record shape (custom or core). */
function getRecordDisplayName(record: Record<string, unknown> | null, primaryKey?: string): string {
  if (!record) { return ''; }
  if (primaryKey) {
    const v = record[primaryKey];
    if (typeof v === 'string' && v.trim() !== '') { return v; }
  }
  const name = record.name;
  if (typeof name === 'string' && name.trim() !== '') { return name; }
  const first = record.firstName ?? record.first_name;
  const last = record.lastName ?? record.last_name;
  if (typeof first === 'string' && typeof last === 'string' && (first + last).trim() !== '') {
    return `${first} ${last}`.trim();
  }
  for (const key of ['title', 'companyName', 'company', 'subject', 'email']) {
    const v = record[key];
    if (typeof v === 'string' && v.trim() !== '') { return v; }
  }
  const id = record.id;
  return typeof id === 'string' ? id : '';
}

/** Resolve the field that holds the record's primary display value. */
function getPrimaryFieldKey(schema: ApiSchema | null, fields: SchemaField[]): string | undefined {
  if (schema?.primaryFieldId) {
    const match = fields.find((f) => f.id === schema.primaryFieldId);
    if (match) { return match.key; }
  }
  const named = fields.find((f) => f.key === 'name' || f.key === 'title');
  return named?.key ?? fields[0]?.key;
}

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const entityName = params.entityName as string;
  const recordId = params.id as string;

  const [schemaList, setSchemaList] = useState<ApiSchema[]>([]);
  const [record, setRecord] = useState<EntityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  // Resolved display names for lookup field values, keyed by `${linkedSchema}:${value}`.
  const [lookupNames, setLookupNames] = useState<Record<string, string>>({});

  // Core CRM objects have bespoke detail pages — a direct hit on the generic
  // /entities/{core}/{id} bounces to the canonical page so there is ONE detail
  // experience per object, never two parallel ones. Custom objects stay here.
  useEffect(() => {
    const base = CORE_OBJECT_ROUTES[entityName];
    if (base) {
      router.replace(`${base}/${recordId}`);
    }
  }, [entityName, recordId, router]);

  // Load schemas
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const res = await authFetch('/api/schemas');
        if (!res.ok) { throw new Error(`Failed to load schemas (${res.status})`); }
        const data = (await res.json()) as SchemaResponse;
        if (isMounted) { setSchemaList(data.schemas ?? []); }
      } catch (err: unknown) {
        logger.error('Error loading schemas for entity detail', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      }
    })();
    return () => { isMounted = false; };
  }, [authFetch]);

  // Load the record
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await authFetch(`/api/entities/${entityName}/records/${recordId}`);
        const json = (await res.json()) as { success?: boolean; record?: EntityRecord };
        if (isMounted && json.success && json.record) {
          setRecord(json.record);
        }
      } catch (err: unknown) {
        logger.error('Error loading entity record', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      } finally {
        if (isMounted) { setLoading(false); }
      }
    })();
    return () => { isMounted = false; };
  }, [authFetch, entityName, recordId]);

  // Resolve the schema for this entity
  const schema = useMemo((): ApiSchema | null => {
    const key = entityName.toLowerCase();
    const fromApi = schemaList.find(
      (s) =>
        s.id?.toLowerCase() === key ||
        s.name?.toLowerCase() === key ||
        s.pluralName?.toLowerCase() === key
    );
    if (fromApi) { return fromApi; }
    const std = STANDARD_SCHEMAS[key as keyof typeof STANDARD_SCHEMAS];
    return std ? (std as ApiSchema) : null;
  }, [entityName, schemaList]);

  const fields: SchemaField[] = useMemo(() => {
    if (schema?.fields) { return schema.fields; }
    return [
      { id: 'f1', key: 'name', label: 'Name', type: 'text' },
      { id: 'f2', key: 'description', label: 'Description', type: 'longText' },
    ];
  }, [schema]);

  const primaryKey = useMemo(() => getPrimaryFieldKey(schema, fields), [schema, fields]);

  // Resolve the target entity (sub-collection name) for a lookup field.
  const lookupTarget = useCallback((field: SchemaField): string => {
    if (field.lookupEntity != null && field.lookupEntity !== '') { return field.lookupEntity; }
    return field.config?.linkedSchema ?? 'contacts';
  }, []);

  // Resolve display names for every lookup value on this record.
  useEffect(() => {
    if (!record) { return; }
    let isMounted = true;
    const lookups = fields.filter((f) => f.type === 'lookup');
    void (async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        lookups.map(async (field) => {
          const value = record[field.key];
          if (typeof value !== 'string' || value === '') { return; }
          const target = lookupTarget(field);
          const cacheKey = `${target}:${value}`;
          try {
            const res = await authFetch(`/api/entities/${target}/records/${value}`);
            if (!res.ok) { return; }
            const json = (await res.json()) as { success?: boolean; record?: Record<string, unknown> };
            if (json.success && json.record) {
              resolved[cacheKey] = getRecordDisplayName(json.record) || value;
            }
          } catch (err: unknown) {
            logger.error('Error resolving lookup value', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
          }
        })
      );
      if (isMounted && Object.keys(resolved).length > 0) {
        setLookupNames((prev) => ({ ...prev, ...resolved }));
      }
    })();
    return () => { isMounted = false; };
  }, [record, fields, authFetch, lookupTarget]);

  const displayName = useMemo(() => {
    if (!record) { return ''; }
    return getRecordDisplayName(record, primaryKey) || 'Untitled';
  }, [record, primaryKey]);

  const entityDisplayName = schema?.pluralName ?? entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Render a single field's value, formatted by type. Lookups become clickable links.
  const renderFieldValue = (field: SchemaField) => {
    if (!record) { return '—'; }
    const value = record[field.key];

    if (field.type === 'lookup') {
      if (typeof value !== 'string' || value === '') { return <span className="text-muted-foreground">—</span>; }
      const target = lookupTarget(field);
      const label = lookupNames[`${target}:${value}`] ?? value;
      const corePath = CORE_OBJECT_ROUTES[target];
      const href = corePath ? `${corePath}/${value}` : `/entities/${target}/${value}`;
      return (
        <button
          onClick={() => router.push(href)}
          className="text-primary hover:opacity-80 text-left"
        >
          {label}
        </button>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">—</span>;
    }

    switch (field.type) {
      case 'currency':
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percent':
        return `${String(value)}%`;
      case 'checkbox':
        return value ? 'Yes' : 'No';
      case 'date':
        try {
          return new Date(value as string | number).toLocaleDateString();
        } catch {
          return String(value);
        }
      case 'url':
        return (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80">
            {String(value)}
          </a>
        );
      case 'email':
        return (
          <a href={`mailto:${String(value)}`} className="text-primary hover:opacity-80">
            {String(value)}
          </a>
        );
      case 'multiSelect':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  };

  if (loading) { return <div className="p-8">Loading...</div>; }
  if (!record) {
    return (
      <div className="p-8 space-y-4">
        <button onClick={() => router.push(`/entities/${entityName}`)} className="text-primary hover:opacity-80">
          ← Back to {entityDisplayName}
        </button>
        <PageTitle>Record not found</PageTitle>
        <p className="text-muted-foreground">This {entityName} record could not be loaded.</p>
      </div>
    );
  }

  const displayInitial = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/entities/${entityName}`)}
          className="text-primary hover:opacity-80 mb-4"
        >
          ← Back to {entityDisplayName}
        </button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-white">
            {schema?.icon ?? displayInitial}
          </div>
          <div className="flex-1">
            <PageTitle className="mb-2">{displayName}</PageTitle>
            <p className="text-muted-foreground">{schema?.singularName ?? entityDisplayName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.id || field.key}>
                  <div className="text-sm text-muted-foreground mb-1">{field.label}</div>
                  <div className="break-words">{renderFieldValue(field)}</div>
                </div>
              ))}
            </div>
          </div>

          <RecordActivityTimeline
            entityType={entityName}
            entityId={recordId}
            entityName={displayName}
          />
        </div>
      </div>
    </div>
  );
}
