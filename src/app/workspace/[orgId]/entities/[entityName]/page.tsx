'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/workspace/demo/schemas" className="text-indigo-600 hover:text-indigo-800">
                ← Schemas
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{entityName}</h1>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                {records.length} records
              </span>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              + Add Record
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {fields.map(field => (
                    <th key={field.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    {fields.map(field => (
                      <td key={field.key} className="px-6 py-4 whitespace-nowrap">
                        {field.type === 'checkbox' ? (
                          <span className={`px-2 py-1 rounded-full text-xs ${record[field.key] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {record[field.key] ? 'Yes' : 'No'}
                          </span>
                        ) : field.key === 'price' ? (
                          <span className="text-gray-900 font-medium">${Number(record[field.key]).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-900">{record[field.key]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleEdit(record)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {records.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No records yet. Click "Add Record" to get started.</p>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {(isAdding || editingId) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isAdding ? 'Add Record' : 'Edit Record'}
                </h2>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                {fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                    </label>
                    {field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={formData[field.key] as boolean}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: field.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                      setFormData({ id: '', name: '', price: 0, description: '', inStock: true });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={isAdding ? handleAdd : handleUpdate}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
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

