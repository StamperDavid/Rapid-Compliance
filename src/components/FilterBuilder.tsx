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
      <div className="bg-neutral-950 rounded-2xl border border-neutral-700 p-8 min-w-[700px] max-w-[900px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white m-0">
            🔍 Filter Records
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 bg-transparent border-none cursor-pointer text-2xl p-1"
          >
            ×
          </button>
        </div>

        {/* Main Logic Toggle */}
        <div className="mb-6 p-3 px-4 bg-neutral-900 border border-neutral-700 rounded-lg flex items-center gap-2">
          <span className="text-sm text-neutral-400">Show records that match</span>
          <button
            onClick={() => setFilter(prev => ({ ...prev, logic: prev.logic === 'AND' ? 'OR' : 'AND' }))}
            className="px-3 py-1.5 text-white border-none rounded-md cursor-pointer text-xs font-semibold"
            style={{ backgroundColor: filter.logic === 'AND' ? '#6366f1' : '#8b5cf6' }}
          >
            {filter.logic}
          </button>
          <span className="text-sm text-neutral-400">of the following</span>
        </div>

        {/* Filter Groups */}
        {filter.groups.map((group, _groupIndex) => (
          <div key={group.id} className="mb-4">
            {/* Group Logic */}
            {group.conditions.length > 1 && (
              <div className="mb-2 pl-4">
                <button
                  onClick={() => toggleGroupLogic(group.id)}
                  className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded cursor-pointer text-xs font-semibold"
                  style={{ color: group.logic === 'AND' ? '#6366f1' : '#8b5cf6' }}
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
                    className="flex-[0_0_180px] p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
                  >
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(group.id, condition.id, { operator: e.target.value as FilterOperator })}
                    className="flex-[0_0_150px] p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
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
                        className="flex-1 p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
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
                        className="flex-1 p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
                      />
                    ) : field?.type === 'number' || field?.type === 'currency' ? (
                      <input
                        type="number"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        className="flex-1 p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
                        placeholder="Enter value..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={condition.value as string}
                        onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                        className="flex-1 p-2 bg-neutral-900 text-white border border-neutral-700 rounded-md text-sm"
                        placeholder="Enter value..."
                      />
                    )
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => removeCondition(group.id, condition.id)}
                    className="p-2 bg-neutral-900 text-red-600 border border-neutral-700 rounded-md cursor-pointer text-sm"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add Condition */}
            <button
              onClick={() => addCondition(group.id)}
              className="p-2 px-4 bg-neutral-900 text-indigo-500 border border-neutral-700 rounded-md cursor-pointer text-sm font-medium"
              style={{ marginLeft: group.conditions.length > 1 ? '2rem' : '0' }}
            >
              + Add condition
            </button>
          </div>
        ))}

        {/* Actions */}
        <div className="flex gap-4 mt-8 pt-6 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="flex-1 p-3 bg-neutral-900 text-neutral-400 border border-neutral-700 rounded-lg cursor-pointer font-semibold text-sm"
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
            className="flex-1 p-3 bg-neutral-900 text-white border border-neutral-700 rounded-lg cursor-pointer font-semibold text-sm"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              setFilter(prev => ({ ...prev, updatedAt: new Date() }));
              onApply(filter);
              onClose();
            }}
            className="flex-1 p-3 bg-indigo-500 text-white border-none rounded-lg cursor-pointer font-semibold text-sm"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}


