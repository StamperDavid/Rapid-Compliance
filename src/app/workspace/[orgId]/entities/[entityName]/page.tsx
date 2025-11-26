'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';

interface Record {
  id: string;
  [key: string]: any;
}

export default function EntityTablePage() {
  const params = useParams();
  const entityName = params.entityName as string;

  // Sample data
  const [records, setRecords] = useState<Record[]>([
    { id: '1', name: 'Premium Widget', price: 99.99, description: 'High-quality widget', inStock: true },
    { id: '2', name: 'Basic Widget', price: 49.99, description: 'Standard widget', inStock: true },
    { id: '3', name: 'Deluxe Widget', price: 149.99, description: 'Top-tier widget', inStock: false },
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record>({
    id: '',
    name: '',
    price: 0,
    description: '',
    inStock: true
  });

  const fields = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'inStock', label: 'In Stock', type: 'checkbox' }
  ];

  const handleAdd = () => {
    const newRecord: Record = {
      ...formData,
      id: Date.now().toString()
    };
    setRecords([...records, newRecord]);
    setIsAdding(false);
    setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
  };

  const handleEdit = (record: Record) => {
    setEditingId(record.id);
    setFormData(record);
  };

  const handleUpdate = () => {
    setRecords(records.map(r => r.id === editingId ? formData : r));
    setEditingId(null);
    setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this record?')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />
      
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href="/workspace/demo-org/schemas" style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Schemas
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#333' }}></div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'capitalize' }}>{entityName}</h1>
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {records.length} records
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              + Add Record
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        {/* Table */}
        <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#111' }}>
              <tr>
                {fields.map(field => (
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
              {records.map((record) => (
                <tr key={record.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {fields.map(field => (
                    <td key={field.key} style={{ padding: '1rem 1.5rem', color: '#fff' }}>
                      {field.type === 'checkbox' ? (
                        <span style={{ padding: '0.25rem 0.5rem', backgroundColor: record[field.key] ? '#065f46' : '#333', color: record[field.key] ? '#6ee7b7' : '#999', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                          {record[field.key] ? 'Yes' : 'No'}
                        </span>
                      ) : field.key === 'price' ? (
                        <span style={{ fontWeight: '600' }}>${Number(record[field.key]).toFixed(2)}</span>
                      ) : (
                        record[field.key]
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleEdit(record)}
                      style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem', fontSize: '0.875rem', fontWeight: '500' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {records.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p>No records yet. Click "Add Record" to get started.</p>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {(isAdding || editingId) && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', maxWidth: '40rem', width: '100%' }}>
              <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                  {isAdding ? 'Add Record' : 'Edit Record'}
                </h2>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
                  }}
                  style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {fields.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      {field.label}
                    </label>
                    {field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={formData[field.key] as boolean}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: field.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                      setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
                    }}
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={isAdding ? handleAdd : handleUpdate}
                    style={{ flex: 1, padding: '0.75rem 1rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', border: 'none' }}
                  >
                    {isAdding ? 'Add' : 'Update'}
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


