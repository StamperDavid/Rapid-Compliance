'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface Schema {
  id: string;
  name: string;
  pluralName: string;
  icon: string;
  fields: Field[];
}

interface ApiErrorResponse {
  error?: string;
}

interface SchemaListResponse {
  schemas?: Schema[];
}

interface SchemaCreateResponse {
  schema?: Schema;
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

const FIELD_TYPES = [
  'text',
  'longText',
  'number',
  'email',
  'url',
  'date',
  'checkbox',
  'singleSelect',
  'multiSelect',
  'currency',
  'phoneNumber'
];

export default function SchemaBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const workspaceId = (searchParams?.get('workspaceId') as string) || 'default';

  // Convert STANDARD_SCHEMAS to the format we need
  const standardSchemasArray: Schema[] = useMemo(() => Object.values(STANDARD_SCHEMAS).map(schema => ({
    id: schema.id,
    name: schema.name,
    pluralName: schema.pluralName,
    icon: schema.icon,
    fields: schema.fields.map(f => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required
    }))
  })), []);

  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editingSchema, setEditingSchema] = useState<Schema | null>(null);

  const [newSchema, setNewSchema] = useState({
    name: '',
    pluralName: '',
    icon: '📋',
    fields: [
      { id: 'f_new_1', key: 'name', label: 'Name', type: 'text', required: true }
    ]
  });

  const loadSchemas = useCallback(async () => {
    if (!orgId || !workspaceId) {return;}
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/schemas?organizationId=${orgId}&workspaceId=${workspaceId}`);
      if (!res.ok) {
        throw new Error(`Failed to load schemas (${res.status})`);
      }
      const data = await res.json() as SchemaListResponse;
      const serverSchemas = data.schemas ?? [];
      if (serverSchemas.length === 0) {
        setSchemas(standardSchemasArray);
      } else {
        setSchemas(serverSchemas);
      }
    } catch (err: unknown) {
      const errorMessage = isErrorWithMessage(err) ? err.message : 'Failed to load schemas';
      setError(errorMessage);
      setSchemas(standardSchemasArray);
    } finally {
      setLoading(false);
    }
  }, [orgId, workspaceId, standardSchemasArray]);

  useEffect(() => {
    void loadSchemas();
  }, [loadSchemas]);

  const handleCreateSchema = async () => {
    if (!newSchema.name || saving) {return;}

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          workspaceId,
          schema: newSchema,
          userId: 'ui-schema-builder'
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(body.error ?? `Failed to create schema (${res.status})`);
      }

      const data = await res.json() as SchemaCreateResponse;
      if (data.schema) {
        setSchemas(prev => [...prev, data.schema as Schema]);
      }

      setIsCreating(false);
      setNewSchema({
        name: '',
        pluralName: '',
        icon: '📋',
        fields: [{ id: 'f_new_1', key: 'name', label: 'Name', type: 'text', required: true }]
      });
    } catch (err: unknown) {
      const errorMessage = isErrorWithMessage(err) ? err.message : 'Failed to create schema';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    const newField = {
      id: `f_new_${Date.now()}`,
      key: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false
    };
    setNewSchema({
      ...newSchema,
      fields: [...newSchema.fields, newField]
    });
  };

  const updateField = (index: number, key: string, value: string | boolean) => {
    const updatedFields = [...newSchema.fields];
    const currentField = updatedFields[index];
    if (currentField) {
      updatedFields[index] = { ...currentField, [key]: value };
    }
    setNewSchema({ ...newSchema, fields: updatedFields });
  };

  const removeField = (index: number) => {
    setNewSchema({
      ...newSchema,
      fields: newSchema.fields.filter((_, i) => i !== index)
    });
  };

  const deleteSchema = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to delete this schema?')) {return;}
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/schemas/${id}?organizationId=${orgId}&workspaceId=${workspaceId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(body.error ?? `Failed to delete schema (${res.status})`);
      }
      setSchemas(prev => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      const errorMessage = isErrorWithMessage(err) ? err.message : 'Failed to delete schema';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const _saveEditedSchema = async () => {
    if (!editingSchema) {return;}
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/schemas/${editingSchema.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          workspaceId,
          updates: editingSchema,
          userId: 'ui-schema-builder'
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as ApiErrorResponse;
        throw new Error(body.error ?? `Failed to update schema (${res.status})`);
      }

      setSchemas(prev => prev.map(s => s.id === editingSchema.id ? editingSchema : s));
      setEditingSchema(null);
    } catch (err: unknown) {
      const errorMessage = isErrorWithMessage(err) ? err.message : 'Failed to update schema';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--color-bg-paper)', borderBottom: '1px solid var(--color-border-main)' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href={`/workspace/${orgId}/settings`} style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Settings
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: 'var(--color-border-main)' }}></div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>Schema Editor</h1>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: 'var(--radius-button)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              + Create Schema
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Info Box */}
        <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-main)', borderRadius: 'var(--radius-card)', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💡</span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Standard CRM Schemas</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                Below are the 10 standard CRM schemas that come pre-configured. You can customize these or create entirely new schemas for your business needs (e.g., Projects, Properties, Vehicles, Cases, etc.).
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--color-error)', border: '1px solid var(--color-border-strong)', color: 'white' }}>
            {error}
          </div>
        )}

        {/* Existing Schemas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {loading && schemas.length === 0 && (
            <div style={{ color: 'var(--color-text-secondary)' }}>Loading schemas...</div>
          )}
          {!loading && schemas.length === 0 && (
            <div style={{ color: 'var(--color-text-secondary)' }}>No schemas found. Create one to get started.</div>
          )}
          {schemas.map((schema) => (
            <div key={schema.id} style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border-main)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{schema.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>{schema.name}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>{schema.pluralName}</p>
                  </div>
                </div>
                <button
                  onClick={() => void deleteSchema(schema.id)}
                  style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Fields ({schema.fields.length})</p>
                {schema.fields.slice(0, 3).map((field) => (
                  <div key={field.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem', backgroundColor: 'var(--color-bg-elevated)', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-input)', marginBottom: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{field.label}</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{field.type}</span>
                  </div>
                ))}
                {schema.fields.length > 3 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>+{schema.fields.length - 3} more</p>
                )}
              </div>

              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--color-border-main)', display: 'flex', gap: '0.5rem' }}>
                <Link
                  href={`/workspace/${orgId}/entities/${(schema.id || schema.name).toLowerCase()}?workspaceId=${workspaceId}`}
                  style={{ flex: 1, textAlign: 'center', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-primary)', borderRadius: 'var(--radius-button)', fontSize: '0.875rem', textDecoration: 'none', border: '1px solid var(--color-border-main)', fontWeight: '500' }}
                >
                  View Data
                </Link>
                <button
                  onClick={() => setEditingSchema(schema)}
                  style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-button)', fontSize: '0.875rem', border: '1px solid var(--color-border-main)', cursor: 'pointer', fontWeight: '500' }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create Schema Form */}
        {isCreating && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', maxWidth: '48rem', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ position: 'sticky', top: 0, backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Create New Schema</h2>
                <button
                  onClick={() => setIsCreating(false)}
                  style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      Schema Name
                    </label>
                    <input
                      type="text"
                      value={newSchema.name}
                      onChange={(e) => setNewSchema({ ...newSchema, name: e.target.value })}
                      placeholder="e.g., Company, Deal, Lead"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      Plural Name
                    </label>
                    <input
                      type="text"
                      value={newSchema.pluralName}
                      onChange={(e) => setNewSchema({ ...newSchema, pluralName: e.target.value })}
                      placeholder="e.g., Companies, Deals, Leads"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    value={newSchema.icon}
                    onChange={(e) => setNewSchema({ ...newSchema, icon: e.target.value })}
                    placeholder="📋"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Fields */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Fields</h3>
                    <button
                      onClick={addField}
                      style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                    >
                      + Add Field
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {newSchema.fields.map((field, index) => (
                      <div key={field.id} style={{ backgroundColor: '#111', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(index, 'label', e.target.value)}
                            placeholder="Field Label"
                            style={{ padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                          />
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(index, 'key', e.target.value)}
                            placeholder="field_key"
                            style={{ padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                          />
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, 'type', e.target.value)}
                            style={{ padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                          >
                            {FIELD_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(index, 'required', e.target.checked)}
                              style={{ width: '1rem', height: '1rem' }}
                            />
                            <span style={{ fontSize: '0.875rem', color: '#999' }}>Required</span>
                          </label>
                          {index > 0 && (
                            <button
                              onClick={() => removeField(index)}
                              style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={() => setIsCreating(false)}
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleCreateSchema()}
                    disabled={!newSchema.name}
                    style={{ flex: 1, padding: '0.75rem 1rem', backgroundColor: newSchema.name ? '#6366f1' : '#333', color: 'white', borderRadius: '0.5rem', cursor: newSchema.name ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: '600', border: 'none' }}
                  >
                    Create Schema
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Schema Modal */}
        {editingSchema && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', maxWidth: '48rem', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ position: 'sticky', top: 0, backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                  {editingSchema.icon} Edit {editingSchema.name}
                </h2>
                <button
                  onClick={() => setEditingSchema(null)}
                  style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      Schema Name
                    </label>
                    <input
                      type="text"
                      value={editingSchema.name}
                      onChange={(e) => setEditingSchema({ ...editingSchema, name: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      Plural Name
                    </label>
                    <input
                      type="text"
                      value={editingSchema.pluralName}
                      onChange={(e) => setEditingSchema({ ...editingSchema, pluralName: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    value={editingSchema.icon}
                    onChange={(e) => setEditingSchema({ ...editingSchema, icon: e.target.value })}
                    style={{ width: '6rem', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1.5rem', textAlign: 'center' }}
                  />
                </div>

                {/* Fields */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#999' }}>
                      Fields ({editingSchema.fields.length})
                    </label>
                    <button
                      onClick={() => setEditingSchema({
                        ...editingSchema,
                        fields: [...editingSchema.fields, { id: `f_edit_${Date.now()}`, key: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false }]
                      })}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: '#1a1a1a', color: '#6366f1', borderRadius: '0.375rem', border: '1px solid #333', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                    >
                      + Add Field
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {editingSchema.fields.map((field, index) => (
                      <div key={field.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', backgroundColor: '#111', borderRadius: '0.5rem', border: '1px solid #222' }}>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const updatedFields = [...editingSchema.fields];
                            updatedFields[index] = { ...field, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                            setEditingSchema({ ...editingSchema, fields: updatedFields });
                          }}
                          placeholder="Field Label"
                          style={{ flex: 2, padding: '0.5rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const updatedFields = [...editingSchema.fields];
                            updatedFields[index] = { ...field, type: e.target.value };
                            setEditingSchema({ ...editingSchema, fields: updatedFields });
                          }}
                          style={{ flex: 1, padding: '0.5rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                        >
                          {FIELD_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#999', fontSize: '0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const updatedFields = [...editingSchema.fields];
                              updatedFields[index] = { ...field, required: e.target.checked };
                              setEditingSchema({ ...editingSchema, fields: updatedFields });
                            }}
                          />
                          Req
                        </label>
                        {index > 0 && (
                          <button
                            onClick={() => setEditingSchema({
                              ...editingSchema,
                              fields: editingSchema.fields.filter((_, i) => i !== index)
                            })}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={() => setEditingSchema(null)}
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Update the schema in the list
                      setSchemas(schemas.map(s => s.id === editingSchema.id ? editingSchema : s));
                      setEditingSchema(null);
                    }}
                    style={{ flex: 1, padding: '0.75rem 1rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', border: 'none' }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
