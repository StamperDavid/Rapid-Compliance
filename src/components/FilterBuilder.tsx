'use client';

import { useState } from 'react';
import { OPERATORS_BY_TYPE, type FilterCondition, type ViewFilter, type FilterOperator } from '@/types/filters';

interface FilterBuilderProps {
  fields: Array<{ key: string; label: string; type: string; options?: string[] }>;
  onApply: (filter: ViewFilter) => void;
  onClose: () => void;
  initialFilter?: ViewFilter;
}

export default function FilterBuilder({ fields, onApply, onClose, initialFilter }: FilterBuilderProps) {
  const [filter, setFilter] = useState<ViewFilter>(initialFilter ?? {
    id: Date.now().toString(),
    name: 'New Filter',
    logic: 'AND',
    groups: [{
      id: 'g1',
      logic: 'AND',
      conditions: [{
        id: 'c1',
        field: fields[0]?.key ?? '',
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
                  field: fields[0]?.key ?? '',
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
    return field?.type ?? 'text';
  };

  const getOperators = (fieldKey: string) => {
    const fieldType = getFieldType(fieldKey);
    return OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.text;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div style={{ backgroundColor: 'var(--color-bg-paper)' }} className="rounded-2xl border border-[var(--color-border-main)] p-8 min-w-[700px] max-w-[900px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold m-0" style={{ color: 'var(--color-text-primary)' }}>
            🔍 Filter Records
          </h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-2xl p-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {/* Main Logic Toggle */}
        <div className="mb-6 p-3 px-4 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-main)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Show records that match</span>
          <button
            onClick={() => setFilter(prev => ({ ...prev, logic: prev.logic === 'AND' ? 'OR' : 'AND' }))}
            className="px-3 py-1.5 border-none rounded-md cursor-pointer text-xs font-semibold"
            style={{ backgroundColor: filter.logic === 'AND' ? 'var(--color-primary)' : 'var(--color-secondary)', color: 'var(--color-text-primary)' }}
          >
            {filter.logic}
          </button>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>of the following</span>
        </div>

        {/* Filter Groups */}
        {filter.groups.map((group, _groupIndex) => (
          <div key={group.id} className="mb-4">
            {/* Group Logic */}
            {group.conditions.length > 1 && (
              <div className="mb-2 pl-4">
                <button
                  onClick={() => toggleGroupLogic(group.id)}
                  className="px-2 py-1 rounded cursor-pointer text-xs font-semibold"
                  style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-main)', color: group.logic === 'AND' ? 'var(--color-primary)' : 'var(--color-secondary)' }}
                >
                  {group.logic}
                </button>
              </div>
            )}

            {/* Conditions */}
            {group.conditions.map((condition, _condIndex) => {
              const field = fields.find(f => f.key === condition.field);
              const operators = getOperators(condition.field);
              const needsValue = !['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(condition.operator);

              return (
                <div
                  key={condition.id}
                  className="flex gap-2 mb-2 items-center"
                  style={{ paddingLeft: group.conditions.length > 1 ? '2rem' : '0' }}
                >
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
                    className="flex-[0_0_180px] p-2 rounded-md text-sm"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
                  >
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(group.id, condition.id, { operator: e.target.value as FilterOperator })}
                    className="flex-[0_0_150px] p-2 rounded-md text-sm"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
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
                        className="flex-1 p-2 rounded-md text-sm"
                        style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
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
                        className="flex-1 p-2 rounded-md text-sm"
                        style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
                      />
                    ) : field?.type === 'number' || field?.type === 'currency' ? (
                      <input
                        type="number"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        className="flex-1 p-2 rounded-md text-sm"
                        style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
                        placeholder="Enter value..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        className="flex-1 p-2 rounded-md text-sm"
                        style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
                        placeholder="Enter value..."
                      />
                    )
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => removeCondition(group.id, condition.id)}
                    className="p-2 rounded-md cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-error)', border: '1px solid var(--color-border-main)' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add Condition */}
            <button
              onClick={() => addCondition(group.id)}
              className="p-2 px-4 rounded-md cursor-pointer text-sm font-medium"
              style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-primary)', border: '1px solid var(--color-border-main)', marginLeft: group.conditions.length > 1 ? '2rem' : '0' }}
            >
              + Add condition
            </button>
          </div>
        ))}

        {/* Actions */}
        <div className="flex gap-4 mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border-main)' }}>
          <button
            onClick={onClose}
            className="flex-1 p-3 rounded-lg cursor-pointer font-semibold text-sm"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-main)' }}
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
                    field: fields[0]?.key ?? '',
                    operator: 'contains',
                    value: '',
                  }]
                }]
              }));
            }}
            className="flex-1 p-3 rounded-lg cursor-pointer font-semibold text-sm"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-main)' }}
          >
            Clear All
          </button>
          <button
            onClick={() => {
              setFilter(prev => ({ ...prev, updatedAt: new Date() }));
              onApply(filter);
              onClose();
            }}
            className="flex-1 p-3 border-none rounded-lg cursor-pointer font-semibold text-sm"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-primary)' }}
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}


