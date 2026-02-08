'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRecords } from '@/hooks/useRecords';
import { STANDARD_SCHEMAS, PICKLIST_VALUES } from '@/lib/schema/standard-schemas'
import { logger } from '@/lib/logger/logger';
import LookupFieldPicker from '@/components/LookupFieldPicker';

// Proper type for dynamic record data
type RecordValue = string | number | boolean | null;

interface EntityRecord {
  id: string;
  [key: string]: RecordValue;
}

interface SchemaField {
  id: string;
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  config?: { linkedSchema?: string };
  lookupEntity?: string;
}

interface ApiSchema {
  id?: string;
  name?: string;
  pluralName?: string;
  singularName?: string;
  icon?: string;
  fields?: SchemaField[];
}

interface SchemaResponse {
  schemas?: ApiSchema[];
}

export default function EntityTablePage() {
  const params = useParams();
  const entityName = params.entityName as string;

  const {
    records,
    loading,
    error,
    create: createRecord,
    update: updateRecord,
    remove: deleteRecord,
  } = useRecords({
    entityName,
    realTime: true,
  });

  const [schemaList, setSchemaList] = useState<ApiSchema[]>([]);

  // Load schemas from API
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const res = await fetch('/api/schemas');
        if (!res.ok) {throw new Error(`Failed to load schemas (${res.status})`);}
        const data = await res.json() as SchemaResponse;
        if (isMounted) {
          setSchemaList(data.schemas ?? []);
        }
      } catch (err: unknown) {
        logger.error('Error loading schemas for entity page', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Get schema dynamically based on entity name
  const schema = useMemo((): ApiSchema | null => {
    const schemaKey = entityName.toLowerCase();
    const fromApi = (schemaList || []).find(
      (s: ApiSchema) =>
        s.id?.toLowerCase() === schemaKey ||
        s.name?.toLowerCase() === schemaKey ||
        s.pluralName?.toLowerCase() === schemaKey
    );
    if (fromApi) {return fromApi;}
    const standardSchema = STANDARD_SCHEMAS[schemaKey as keyof typeof STANDARD_SCHEMAS];
    return standardSchema ? standardSchema as ApiSchema : null;
  }, [entityName, schemaList]);

  // Get fields from schema or fallback to generic
  const fields: SchemaField[] = useMemo(() => {
    if (schema?.fields) {
      return schema.fields;
    }
    // Fallback for custom entities
    return [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'description', label: 'Description', type: 'longText', required: false },
    ];
  }, [schema]);

  // Generate default form data based on schema fields
  const getDefaultFormData = useCallback((): EntityRecord => {
    const defaults: EntityRecord = { id: '' };
    fields.forEach(field => {
      switch (field.type) {
        case 'number':
        case 'currency':
        case 'percent':
          defaults[field.key] = 0;
          break;
        case 'checkbox':
          defaults[field.key] = false;
          break;
        case 'date':
          defaults[field.key] = '';
          break;
        case 'singleSelect':
          defaults[field.key] = '';
          break;
        default:
          defaults[field.key] = '';
      }
    });
    return defaults;
  }, [fields]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EntityRecord>(getDefaultFormData());
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Reset form data when entity changes
  useEffect(() => {
    setFormData(getDefaultFormData());
  }, [getDefaultFormData]);

  // Get picklist options for a field
  const getPicklistOptions = (field: SchemaField): string[] => {
    if (field.options) {return field.options;}

    // Map field keys to picklist values
    const picklistMap: Record<string, keyof typeof PICKLIST_VALUES> = {
      'lead_source': 'lead_source',
      'lead_status': 'lead_status',
      'rating': 'lead_rating',
      'industry': 'industry',
      'status': entityName === 'leads' ? 'lead_status'
              : entityName === 'contacts' ? 'contact_status'
              : entityName === 'companies' ? 'company_status'
              : entityName === 'deals' ? 'deal_stage'
              : entityName === 'quotes' ? 'quote_status'
              : entityName === 'invoices' ? 'invoice_status'
              : entityName === 'orders' ? 'order_status'
              : entityName === 'tasks' ? 'task_status'
              : entityName === 'payments' ? 'payment_status'
              : 'company_status',
      'stage': 'deal_stage',
      'priority': 'task_priority',
      'category': 'product_category',
      'payment_method': 'payment_method',
    };

    const picklistKey = picklistMap[field.key];
    if (picklistKey && PICKLIST_VALUES[picklistKey]) {
      return PICKLIST_VALUES[picklistKey];
    }

    return [];
  };

  // Filtered records based on search
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {return records;}
    const term = searchTerm.toLowerCase();
    return records.filter(record =>
      fields.some(field => {
        const value = record[field.key];
        return value && String(value).toLowerCase().includes(term);
      })
    );
  }, [records, searchTerm, fields]);

  // Key fields to show in table (first 5 non-lookup fields)
  const tableFields = useMemo(() => {
    return fields
      .filter(f => f.type !== 'lookup' && f.type !== 'longText')
      .slice(0, 5);
  }, [fields]);

  const handleAdd = async () => {
    try {

      const { id: _id, ...data } = formData;
      await createRecord(data);
      setIsAdding(false);
      setFormData(getDefaultFormData());
      setNotification({ message: 'Record created successfully', type: 'success' });
    } catch (err: unknown) {
      logger.error('Error creating record:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      setNotification({ message: 'Failed to create record.', type: 'error' });
    }
  };

  const handleEdit = (record: EntityRecord) => {
    setEditingId(record.id);
    // Populate form with record data
    const editData: EntityRecord = { id: record.id };
    const defaults = getDefaultFormData();
    fields.forEach(field => {
      const value = record[field.key];
      editData[field.key] = value ?? defaults[field.key];
    });
    setFormData(editData);
  };

  const handleUpdate = async () => {
    if (!editingId) {return;}
    try {

      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...updateData } = formData;
      await updateRecord(editingId, updateData);
      setEditingId(null);
      setFormData(getDefaultFormData());
      setNotification({ message: 'Record updated successfully', type: 'success' });
    } catch (err: unknown) {
      logger.error('Error updating record:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      setNotification({ message: 'Failed to update record.', type: 'error' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      message: 'Delete this record?',
      onConfirm: () => {
        void (async () => {
          try {
            await deleteRecord(id);
            setConfirmDialog(null);
            setNotification({ message: 'Record deleted successfully', type: 'success' });
          } catch (err: unknown) {
            logger.error('Error deleting record:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
            setConfirmDialog(null);
            setNotification({ message: 'Failed to delete record.', type: 'error' });
          }
        })();
      },
    });
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(getDefaultFormData());
  };

  // Format value for display
  const formatValue = (value: RecordValue, field: SchemaField): string => {
    if (value === null || value === undefined || value === '') {return '—';}

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
      default:
        return String(value);
    }
  };

  // Render form field based on type
  const renderFormField = (field: SchemaField) => {
    const value = formData[field.key];
    const baseInputStyle = {
      width: '100%',
      padding: '0.625rem 0.875rem',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      border: '1px solid #333',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
    };

    switch (field.type) {
      case 'checkbox':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
              style={{ width: '1.25rem', height: '1.25rem', accentColor: '#6366f1' }}
            />
            <span style={{ color: '#ccc', fontSize: '0.875rem' }}>
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );

      case 'singleSelect': {
        const options = getPicklistOptions(field);
        const selectValue = value ?? '';
        return (
          <select
            value={String(selectValue)}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={{ ...baseInputStyle, cursor: 'pointer' }}
          >
            <option value="">Select {field.label}...</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }

      case 'longText':
        return (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={{ ...baseInputStyle, minHeight: '100px', resize: 'vertical' }}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'number':
      case 'currency':
      case 'percent':
        return (
          <input
            type="number"
            value={Number(value ?? 0)}
            onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
            style={baseInputStyle}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            step={field.type === 'currency' ? '0.01' : '1'}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={baseInputStyle}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={baseInputStyle}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={baseInputStyle}
            placeholder="https://..."
          />
        );

      case 'phoneNumber':
        return (
          <input
            type="tel"
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={baseInputStyle}
            placeholder="+1 (555) 123-4567"
          />
        );

      case 'lookup': {
        // Lookup field with record picker
        return (
          <LookupFieldPicker
            workspaceId="default"
            targetEntity={(field.lookupEntity !== '' && field.lookupEntity != null) ? field.lookupEntity : 'contacts'}
            value={typeof value === 'string' ? value : value != null ? String(value) : null}
            onChange={(recordId: string | null) => {
              setFormData({ ...formData, [field.key]: recordId });
            }}
            label={field.label}
            placeholder={`Search ${(field.lookupEntity !== '' && field.lookupEntity != null) ? field.lookupEntity : 'records'}...`}
            style={baseInputStyle}
          />
        );
      }

      default:
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            style={baseInputStyle}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  const entityDisplayName = schema?.pluralName ?? entityName.charAt(0).toUpperCase() + entityName.slice(1);
  const schemaIcon = schema?.icon;
  const entityIcon = (schemaIcon ?? '📋');
  const singularName = (schema?.singularName && schema.singularName !== '') ? schema.singularName : 'Record';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 2rem' }}>
          {/* Notification */}
          {notification && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: notification.type === 'success' ? '#065f46' : '#7f1d1d', border: `1px solid ${notification.type === 'success' ? '#10b981' : '#dc2626'}`, borderRadius: '0.5rem', color: notification.type === 'success' ? '#6ee7b7' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.8 }}>&times;</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href={`/schemas`} style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Schemas
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#333' }}></div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{entityIcon}</span>
                  {entityDisplayName}
                </h1>
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {loading ? 'Loading...' : `${filteredRecords.length} records`}
                  {searchTerm && ` (filtered from ${records.length})`}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  style={{
                    padding: '0.5rem 1rem 0.5rem 2.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    width: '200px',
                  }}
                />
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }}>🔍</span>
              </div>
              <button
                onClick={() => setIsAdding(true)}
                style={{ padding: '0.625rem 1.5rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                + Add {singularName}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p>Loading {typeof entityDisplayName === 'string' ? entityDisplayName.toLowerCase() : 'records'}...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
            <p>Error: {error.message}</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#111' }}>
                <tr>
                  {tableFields.map(field => (
                    <th key={field.key} style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', borderBottom: '2px solid #1a1a1a' }}>
                      {field.label}
                    </th>
                  ))}
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', borderBottom: '2px solid #1a1a1a' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={String(record.id)} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    {tableFields.map(field => (
                      <td key={field.key} style={{ padding: '1rem 1.5rem', color: '#fff' }}>
                        {field.type === 'checkbox' ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: record[field.key] ? '#065f46' : '#333',
                            color: record[field.key] ? '#6ee7b7' : '#999',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {record[field.key] ? 'Yes' : 'No'}
                          </span>
                        ) : field.type === 'singleSelect' && record[field.key] ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#1e1b4b',
                            color: '#a5b4fc',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {String(record[field.key])}
                          </span>
                        ) : (
                          <span style={{ fontWeight: field.key === 'name' || field.key === 'first_name' ? '600' : '400' }}>
                            {formatValue(record[field.key] as RecordValue, field)}
                          </span>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(record as EntityRecord)}
                        style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem', fontSize: '0.875rem', fontWeight: '500' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(String(record.id))}
                        style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRecords.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                {searchTerm ? (
                  <p>No {typeof entityDisplayName === 'string' ? entityDisplayName.toLowerCase() : 'records'} matching &quot;{searchTerm}&quot;</p>
                ) : (
                  <p>No {typeof entityDisplayName === 'string' ? entityDisplayName.toLowerCase() : 'records'} yet. Click &quot;Add {singularName}&quot; to get started.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {(isAdding || editingId) && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', maxWidth: '40rem', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{entityIcon}</span>
                  {isAdding ? `Add ${singularName}` : `Edit ${singularName}`}
                </h2>
                <button
                  onClick={closeModal}
                  style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
                {fields.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {renderFormField(field)}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={closeModal}
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void (isAdding ? handleAdd() : handleUpdate())}
                    style={{ flex: 1, padding: '0.75rem 1rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', border: 'none' }}
                  >
                    {isAdding ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '1.5rem', maxWidth: '400px', width: '100%' }}>
              <p style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>{confirmDialog.message}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setConfirmDialog(null)} style={{ padding: '0.5rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                <button onClick={confirmDialog.onConfirm} style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', border: 'none' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
