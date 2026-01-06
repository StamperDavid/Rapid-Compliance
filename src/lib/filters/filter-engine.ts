/**
 * Filter Engine
 * Apply Airtable-style filters to data
 */

import type { FilterCondition, FilterGroup, FilterLogic, ViewFilter } from '@/types/filters';

export class FilterEngine {
  /**
   * Apply filter to data array
   */
  static applyFilter(data: any[], filter: ViewFilter): any[] {
    if (!filter.groups || filter.groups.length === 0) {
      return data;
    }

    return data.filter(record => {
      const groupResults = filter.groups.map(group => 
        this.evaluateGroup(record, group)
      );

      // Combine group results with main logic (AND/OR)
      return filter.logic === 'AND'
        ? groupResults.every(result => result)
        : groupResults.some(result => result);
    });
  }

  /**
   * Evaluate a filter group
   */
  private static evaluateGroup(record: any, group: FilterGroup): boolean {
    if (group.conditions.length === 0) {return true;}

    const results = group.conditions.map(condition =>
      this.evaluateCondition(record, condition)
    );

    return group.logic === 'AND'
      ? results.every(result => result)
      : results.some(result => result);
  }

  /**
   * Evaluate single condition
   */
  private static evaluateCondition(record: any, condition: FilterCondition): boolean {
    const fieldValue = record[condition.field];
    const { operator, value } = condition;

    // Handle empty/not empty operators
    if (operator === 'is_empty') {
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    }
    if (operator === 'is_not_empty') {
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    }

    // Text operators
    if (operator === 'contains') {
      return String(fieldValue || '').toLowerCase().includes(String(value || '').toLowerCase());
    }
    if (operator === 'does_not_contain') {
      return !String(fieldValue || '').toLowerCase().includes(String(value || '').toLowerCase());
    }
    if (operator === 'is') {
      return String(fieldValue || '').toLowerCase() === String(value || '').toLowerCase();
    }
    if (operator === 'is_not') {
      return String(fieldValue || '').toLowerCase() !== String(value || '').toLowerCase();
    }
    if (operator === 'starts_with') {
      return String(fieldValue || '').toLowerCase().startsWith(String(value || '').toLowerCase());
    }
    if (operator === 'ends_with') {
      return String(fieldValue || '').toLowerCase().endsWith(String(value || '').toLowerCase());
    }

    // Number operators
    if (operator === 'equals') {
      return Number(fieldValue) === Number(value);
    }
    if (operator === 'not_equals') {
      return Number(fieldValue) !== Number(value);
    }
    if (operator === 'greater_than') {
      return Number(fieldValue) > Number(value);
    }
    if (operator === 'greater_than_or_equal') {
      return Number(fieldValue) >= Number(value);
    }
    if (operator === 'less_than') {
      return Number(fieldValue) < Number(value);
    }
    if (operator === 'less_than_or_equal') {
      return Number(fieldValue) <= Number(value);
    }

    // Date operators
    if (operator === 'is_on') {
      return this.isSameDay(new Date(fieldValue), new Date(value));
    }
    if (operator === 'is_before') {
      return new Date(fieldValue) < new Date(value);
    }
    if (operator === 'is_after') {
      return new Date(fieldValue) > new Date(value);
    }
    if (operator === 'is_on_or_before') {
      return new Date(fieldValue) <= new Date(value);
    }
    if (operator === 'is_on_or_after') {
      return new Date(fieldValue) >= new Date(value);
    }

    // Array/Select operators
    if (operator === 'has_any_of') {
      const values = Array.isArray(value) ? value : [value];
      return values.some(v => fieldValue === v || (Array.isArray(fieldValue) && fieldValue.includes(v)));
    }
    if (operator === 'has_all_of') {
      const values = Array.isArray(value) ? value : [value];
      return values.every(v => fieldValue === v || (Array.isArray(fieldValue) && fieldValue.includes(v)));
    }
    if (operator === 'has_none_of') {
      const values = Array.isArray(value) ? value : [value];
      return !values.some(v => fieldValue === v || (Array.isArray(fieldValue) && fieldValue.includes(v)));
    }

    // Boolean operators
    if (operator === 'is_checked') {
      return fieldValue === true || fieldValue === 'true' || fieldValue === 1;
    }
    if (operator === 'is_not_checked') {
      return fieldValue === false || fieldValue === 'false' || fieldValue === 0 || !fieldValue;
    }

    return false;
  }

  /**
   * Helper: Check if two dates are the same day
   */
  private static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Get operator label
   */
  static getOperatorLabel(operator: string): string {
    const operatorMap: Record<string, string> = {
      contains: 'contains',
      does_not_contain: 'does not contain',
      is: 'is',
      is_not: 'is not',
      is_empty: 'is empty',
      is_not_empty: 'is not empty',
      starts_with: 'starts with',
      ends_with: 'ends with',
      equals: '=',
      not_equals: '≠',
      greater_than: '>',
      greater_than_or_equal: '≥',
      less_than: '<',
      less_than_or_equal: '≤',
      is_on: 'is on',
      is_before: 'is before',
      is_after: 'is after',
      is_checked: 'is checked',
      is_not_checked: 'is not checked',
    };
    return operatorMap[operator] || operator;
  }
}


