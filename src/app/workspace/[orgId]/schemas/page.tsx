'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  const [schemas, setSchemas] = useState<Schema[]>([
    {
      id: 'schema_1',
      name: 'Product',
      pluralName: 'Products',
      icon: '📦',
      fields: [
        { id: 'f1', key: 'name', label: 'Product Name', type: 'text', required: true },
        { id: 'f2', key: 'price', label: 'Price', type: 'currency', required: true },
        { id: 'f3', key: 'description', label: 'Description', type: 'longText', required: false }
      ]
    }
  ]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-indigo-600 hover:text-indigo-800">
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Schema Builder</h1>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              + Create Schema
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Existing Schemas */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {schemas.map((schema) => (
            <div key={schema.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{schema.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{schema.name}</h3>
                    <p className="text-sm text-gray-500">{schema.pluralName}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteSchema(schema.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Fields ({schema.fields.length})</p>
                {schema.fields.slice(0, 3).map((field) => (
                  <div key={field.id} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                    <span className="text-gray-700">{field.label}</span>
                    <span className="text-gray-500 text-xs">{field.type}</span>
                  </div>
                ))}
                {schema.fields.length > 3 && (
                  <p className="text-xs text-gray-500">+{schema.fields.length - 3} more</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <Link
                  href={`/workspace/demo/entities/${schema.name.toLowerCase()}`}
                  className="flex-1 text-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 transition"
                >
                  View Data
                </Link>
                <button
                  onClick={() => setEditingSchema(schema)}
                  className="flex-1 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create Schema Form */}
        {isCreating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New Schema</h2>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schema Name
                    </label>
                    <input
                      type="text"
                      value={newSchema.name}
                      onChange={(e) => setNewSchema({ ...newSchema, name: e.target.value })}
                      placeholder="e.g., Company, Deal, Lead"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Plural Name
                    </label>
                    <input
                      type="text"
                      value={newSchema.pluralName}
                      onChange={(e) => setNewSchema({ ...newSchema, pluralName: e.target.value })}
                      placeholder="e.g., Companies, Deals, Leads"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    value={newSchema.icon}
                    onChange={(e) => setNewSchema({ ...newSchema, icon: e.target.value })}
                    placeholder="📋"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Fields */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Fields</h3>
                    <button
                      onClick={addField}
                      className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                    >
                      + Add Field
                    </button>
                  </div>

                  <div className="space-y-4">
                    {newSchema.fields.map((field, index) => (
                      <div key={field.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="grid md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(index, 'label', e.target.value)}
                            placeholder="Field Label"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(index, 'key', e.target.value)}
                            placeholder="field_key"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, 'type', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            {FIELD_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(index, 'required', e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>
                          {index > 0 && (
                            <button
                              onClick={() => removeField(index)}
                              className="text-red-500 hover:text-red-700 text-sm"
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
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSchema}
                    disabled={!newSchema.name}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Create Schema
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

