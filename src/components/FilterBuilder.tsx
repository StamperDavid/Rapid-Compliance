'use client';

import { useState } from 'react';
import type { FilterCondition, FilterGroup, ViewFilter, FilterLogic } from '@/types/filters';
import { OPERATORS_BY_TYPE } from '@/types/filters';

interface FilterBuilderProps {
  fields: Array<{ key: string; label: string; type: string; options?: string[] }>;
  onApply: (filter: ViewFilter) => void;
  onClose: () => void;
  initialFilter?: ViewFilter;
}

export default function FilterBuilder({ fields, onApply, onClose, initialFilter }: FilterBuilderProps) {
  const [filter, setFilter] = useState<ViewFilter>(initialFilter || {
    id: Date.now().toString(),
    name: 'New Filter',
    logic: 'AND',
    groups: [{
      id: 'g1',
      logic: 'AND',
      conditions: [{
        id: 'c1',
        field: fields[0]?.key || '',
        operator: 'contains',
        value: '',
      }]
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const addCondition = (groupId: string) => {
    setFilter(prev => ({
      ...prev,
      groups: prev.groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: [
                ...group.conditions,
                {
                  id: `c${Date.now()}`,
                  field: fields[0]?.key || '',
                  operator: 'contains',
                  value: '',
                }
              ]
            }
          : group
      )
    }));
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    setFilter(prev => ({
      ...prev,
      groups: prev.groups.map(group =>
        group.id === groupId
          ? { ...group, conditions: group.conditions.filter(c => c.id !== conditionId) }
          : group
      ).filter(group => group.conditions.length > 0)
    }));
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setFilter(prev => ({
      ...prev,
      groups: prev.groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map(cond =>
                cond.id === conditionId ? { ...cond, ...updates } : cond
              )
            }
          : group
      )
    }));
  };

  const toggleGroupLogic = (groupId: string) => {
    setFilter(prev => ({
      ...prev,
      groups: prev.groups.map(group =>
        group.id === groupId
          ? { ...group, logic: group.logic === 'AND' ? 'OR' : 'AND' }
          : group
      )
    }));
  };

  const getFieldType = (fieldKey: string): string => {
    const field = fields.find(f => f.key === fieldKey);
    return field?.type || 'text';
  };

  const getOperators = (fieldKey: string) => {
    const fieldType = getFieldType(fieldKey);
    return OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.text;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '2rem', minWidth: '700px', maxWidth: '900px', maxHeight: '80vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            🔍 Filter Records
          </h3>
          <button
            onClick={onClose}
            style={{ color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: '0.25rem' }}
          >
            ×
          </button>
        </div>

        {/* Main Logic Toggle */}
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#999' }}>Show records that match</span>
          <button
            onClick={() => setFilter(prev => ({ ...prev, logic: prev.logic === 'AND' ? 'OR' : 'AND' }))}
            style={{ padding: '0.375rem 0.75rem', backgroundColor: filter.logic === 'AND' ? '#6366f1' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
          >
            {filter.logic}
          </button>
          <span style={{ fontSize: '0.875rem', color: '#999' }}>of the following</span>
        </div>

        {/* Filter Groups */}
        {filter.groups.map((group, groupIndex) => (
          <div key={group.id} style={{ marginBottom: '1rem' }}>
            {/* Group Logic */}
            {group.conditions.length > 1 && (
              <div style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                <button
                  onClick={() => toggleGroupLogic(group.id)}
                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#222', color: group.logic === 'AND' ? '#6366f1' : '#8b5cf6', border: '1px solid #333', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                >
                  {group.logic}
                </button>
              </div>
            )}

            {/* Conditions */}
            {group.conditions.map((condition, condIndex) => {
              const field = fields.find(f => f.key === condition.field);
              const operators = getOperators(condition.field);
              const needsValue = !['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(condition.operator);

              return (
                <div key={condition.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', paddingLeft: group.conditions.length > 1 ? '2rem' : '0' }}>
                  {/* Field Select */}
                  <select
                    value={condition.field}
                    onChange={(e) => {
                      const newField = e.target.value;
                      const newOperators = getOperators(newField);
                      updateCondition(group.id, condition.id, { 
                        field: newField,
                        operator: newOperators[0].value,
                        value: ''
                      });
                    }}
                    style={{ flex: '0 0 180px', padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  >
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(group.id, condition.id, { operator: e.target.value as any })}
                    style={{ flex: '0 0 150px', padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {/* Value Input */}
                  {needsValue && (
                    field?.type === 'select' || field?.type === 'singleSelect' ? (
                      <select
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                      >
                        <option value="">Select...</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field?.type === 'date' ? (
                      <input
                        type="date"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                      />
                    ) : field?.type === 'number' || field?.type === 'currency' ? (
                      <input
                        type="number"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                        placeholder="Enter value..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                        placeholder="Enter value..."
                      />
                    )
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => removeCondition(group.id, condition.id)}
                    style={{ padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#dc2626', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add Condition */}
            <button
              onClick={() => addCondition(group.id)}
              style={{ marginLeft: group.conditions.length > 1 ? '2rem' : '0', padding: '0.5rem 1rem', backgroundColor: '#1a1a1a', color: '#6366f1', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
            >
              + Add condition
            </button>
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #333' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#999', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setFilter(prev => ({
                ...prev,
                groups: [{
                  id: 'g1',
                  logic: 'AND',
                  conditions: [{
                    id: 'c1',
                    field: fields[0]?.key || '',
                    operator: 'contains',
                    value: '',
                  }]
                }]
              }));
            }}
            style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
          >
            Clear All
          </button>
          <button
            onClick={() => {
              setFilter(prev => ({ ...prev, updatedAt: new Date() }));
              onApply(filter);
              onClose();
            }}
            style={{ flex: 1, padding: '0.75rem', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}


