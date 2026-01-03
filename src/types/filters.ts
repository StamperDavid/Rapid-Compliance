/**
 * Advanced Filter System (Airtable-style)
 * Multi-condition filtering with AND/OR logic
 */

export type FilterOperator = 
  // Text operators
  | 'contains'
  | 'does_not_contain'
  | 'is'
  | 'is_not'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with'
  // Number operators
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_within'
  // Date operators
  | 'is_on'
  | 'is_before'
  | 'is_after'
  | 'is_on_or_before'
  | 'is_on_or_after'
  | 'is_within_last'
  | 'is_within_next'
  // Array/Select operators
  | 'has_any_of'
  | 'has_all_of'
  | 'has_none_of'
  | 'is_exactly'
  // Boolean operators
  | 'is_checked'
  | 'is_not_checked';

export type FilterLogic = 'AND' | 'OR';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  valueType?: 'text' | 'number' | 'date' | 'select' | 'boolean';
}

export interface FilterGroup {
  id: string;
  logic: FilterLogic;
  conditions: FilterCondition[];
}

export interface ViewFilter {
  id: string;
  name: string;
  logic: FilterLogic; // AND or OR between groups
  groups: FilterGroup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedView {
  id: string;
  name: string;
  entityType: string;
  filter: ViewFilter;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  visibleFields?: string[];
  groupBy?: string;
  isDefault?: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Operators available for each field type
export const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'does_not_contain', label: 'does not contain' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_than_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_than_or_equal', label: '≤' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  currency: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_than_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_than_or_equal', label: '≤' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'is_on', label: 'is on' },
    { value: 'is_before', label: 'is before' },
    { value: 'is_after', label: 'is after' },
    { value: 'is_on_or_before', label: 'is on or before' },
    { value: 'is_on_or_after', label: 'is on or after' },
    { value: 'is_within_last', label: 'is within last' },
    { value: 'is_within_next', label: 'is within next' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  select: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'has_any_of', label: 'has any of' },
    { value: 'has_all_of', label: 'has all of' },
    { value: 'has_none_of', label: 'has none of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  checkbox: [
    { value: 'is_checked', label: 'is checked' },
    { value: 'is_not_checked', label: 'is not checked' },
  ],
  email: [
    { value: 'contains', label: 'contains' },
    { value: 'does_not_contain', label: 'does not contain' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  phone: [
    { value: 'contains', label: 'contains' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
};


