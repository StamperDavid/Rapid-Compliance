'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
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
  // Convert STANDARD_SCHEMAS to the format we need
  const standardSchemasArray: Schema[] = Object.values(STANDARD_SCHEMAS).map(schema => ({
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
  }));

  const [schemas, setSchemas] = useState<Schema[]>(standardSchemasArray);

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

  const handleCreateSchema = () => {
    if (!newSchema.name) return;

    const schema: Schema = {
      id: `schema_${Date.now()}`,
      name: newSchema.name,
      pluralName: newSchema.pluralName || newSchema.name + 's',
      icon: newSchema.icon,
      fields: newSchema.fields
    };

    setSchemas([...schemas, schema]);
    setIsCreating(false);
    setNewSchema({
      name: '',
      pluralName: '',
      icon: '📋',
      fields: [{ id: 'f_new_1', key: 'name', label: 'Name', type: 'text', required: true }]
    });
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

  const updateField = (index: number, key: string, value: any) => {
    const updatedFields = [...newSchema.fields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    setNewSchema({ ...newSchema, fields: updatedFields });
  };

  const removeField = (index: number) => {
    setNewSchema({
      ...newSchema,
      fields: newSchema.fields.filter((_, i) => i !== index)
    });
  };

  const deleteSchema = (id: string) => {
    if (confirm('Are you sure you want to delete this schema?')) {
      setSchemas(schemas.filter(s => s.id !== id));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />
      
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href={`/workspace/${orgId}/settings`} style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Settings
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#333' }}></div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Schema Editor</h1>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              + Create Schema
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Info Box */}
        <div style={{ backgroundColor: '#1a2e1a', border: '1px solid #2d4a2d', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💡</span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6ee7b7', marginBottom: '0.5rem' }}>Standard CRM Schemas</div>
              <div style={{ fontSize: '0.875rem', color: '#86efac', lineHeight: '1.6' }}>
                Below are the 10 standard CRM schemas that come pre-configured. You can customize these or create entirely new schemas for your business needs (e.g., Projects, Properties, Vehicles, Cases, etc.).
              </div>
            </div>
          </div>
        </div>

        {/* Existing Schemas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {schemas.map((schema) => (
            <div key={schema.id} style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{schema.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{schema.name}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>{schema.pluralName}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteSchema(schema.id)}
                  style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Fields ({schema.fields.length})</p>
                {schema.fields.slice(0, 3).map((field) => (
                  <div key={field.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem', backgroundColor: '#111', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#fff' }}>{field.label}</span>
                    <span style={{ color: '#666', fontSize: '0.75rem' }}>{field.type}</span>
                  </div>
                ))}
                {schema.fields.length > 3 && (
                  <p style={{ fontSize: '0.75rem', color: '#666' }}>+{schema.fields.length - 3} more</p>
                )}
              </div>

              <div style={{ paddingTop: '1rem', borderTop: '1px solid #1a1a1a', display: 'flex', gap: '0.5rem' }}>
                <Link
                  href={`/workspace/${orgId}/entities/${schema.name.toLowerCase()}`}
                  style={{ flex: 1, textAlign: 'center', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#6366f1', borderRadius: '0.5rem', fontSize: '0.875rem', textDecoration: 'none', border: '1px solid #333', fontWeight: '500' }}
                >
                  View Data
                </Link>
                <button
                  onClick={() => setEditingSchema(schema)}
                  style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: '#222', color: '#999', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid #333', cursor: 'pointer', fontWeight: '500' }}
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
                    onClick={handleCreateSchema}
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
