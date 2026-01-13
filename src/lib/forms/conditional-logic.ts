/**
 * Conditional Logic Engine
 *
 * Evaluates conditional rules for form fields to determine visibility,
 * requirements, and field values based on user input.
 *
 * CAPABILITIES:
 * - Show/Hide fields based on other field values
 * - Enable/Disable fields conditionally
 * - Dynamic required fields
 * - Page skip logic for multi-step forms
 * - Calculated field values
 *
 * @module forms/conditional-logic
 * @version 1.0.0
 */

import type {
  FormFieldConfig,
  FormDefinition,
  FieldResponse,
  ConditionalLogic,
  ConditionalCondition,
  FormPage,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of evaluating conditional logic for a field
 */
export interface ConditionalEvaluationResult {
  fieldId: string;
  isVisible: boolean;
  isRequired: boolean;
  isDisabled: boolean;
  calculatedValue?: unknown;
}

/**
 * Result of evaluating page-level conditions
 */
export interface PageEvaluationResult {
  pageId: string;
  pageIndex: number;
  shouldShow: boolean;
  shouldSkip: boolean;
}

/**
 * Complete evaluation state for a form
 */
export interface FormConditionalState {
  fields: Map<string, ConditionalEvaluationResult>;
  pages: Map<string, PageEvaluationResult>;
  activePageIndices: number[];
  errors: string[];
}

/**
 * Context for conditional evaluation
 */
export interface EvaluationContext {
  form: FormDefinition;
  fields: FormFieldConfig[];
  responses: Map<string, FieldResponse>;
  currentPageIndex: number;
}

// ============================================================================
// CONDITION EVALUATORS
// ============================================================================

/**
 * Evaluate a single condition against a field value
 */
export function evaluateCondition(
  condition: ConditionalCondition,
  responses: Map<string, FieldResponse>
): boolean {
  const response = responses.get(condition.fieldId);
  const fieldValue = response?.value;

  switch (condition.operator) {
    case 'equals':
      return areValuesEqual(fieldValue, condition.value);

    case 'not_equals':
      return !areValuesEqual(fieldValue, condition.value);

    case 'contains':
      return valueContains(fieldValue, condition.value);

    case 'not_contains':
      return !valueContains(fieldValue, condition.value);

    case 'greater_than':
      return compareValues(fieldValue, condition.value) > 0;

    case 'less_than':
      return compareValues(fieldValue, condition.value) < 0;

    case 'is_empty':
      return isValueEmpty(fieldValue);

    case 'is_not_empty':
      return !isValueEmpty(fieldValue);

    case 'starts_with':
      return valueStartsWith(fieldValue, condition.value);

    case 'ends_with':
      return valueEndsWith(fieldValue, condition.value);

    default:
      console.warn(`Unknown condition operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Evaluate all conditions in a conditional logic block
 */
export function evaluateConditions(
  conditionalLogic: ConditionalLogic,
  responses: Map<string, FieldResponse>
): boolean {
  if (!conditionalLogic.enabled || conditionalLogic.conditions.length === 0) {
    return true; // No conditions = always show
  }

  const results = conditionalLogic.conditions.map((condition) =>
    evaluateCondition(condition, responses)
  );

  // Combine results based on logic type
  const combinedResult =
    conditionalLogic.logicType === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);

  // Apply action (show vs hide)
  return conditionalLogic.action === 'show' ? combinedResult : !combinedResult;
}

// ============================================================================
// VALUE COMPARISON HELPERS
// ============================================================================

/**
 * Check if two values are equal (handles arrays and different types)
 */
function areValuesEqual(
  value1: unknown,
  value2: string | number | boolean | string[]
): boolean {
  // Handle null/undefined
  if (value1 == null && value2 == null) return true;
  if (value1 == null || value2 == null) return false;

  // Handle array comparison
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false;
    return value1.every((v, i) => String(v) === String(value2[i]));
  }

  // Handle array contains single value
  if (Array.isArray(value1)) {
    return value1.some((v) => String(v) === String(value2));
  }

  // String comparison (case-insensitive)
  return String(value1).toLowerCase() === String(value2).toLowerCase();
}

/**
 * Check if a value contains another value
 */
function valueContains(
  value: unknown,
  searchValue: string | number | boolean | string[]
): boolean {
  if (value == null) return false;

  if (Array.isArray(value)) {
    if (Array.isArray(searchValue)) {
      return searchValue.some((sv) =>
        value.some((v) => String(v).toLowerCase().includes(String(sv).toLowerCase()))
      );
    }
    return value.some((v) =>
      String(v).toLowerCase().includes(String(searchValue).toLowerCase())
    );
  }

  return String(value).toLowerCase().includes(String(searchValue).toLowerCase());
}

/**
 * Compare two values numerically or lexically
 */
function compareValues(
  value1: unknown,
  value2: string | number | boolean | string[]
): number {
  if (value1 == null) return -1;
  if (value2 == null) return 1;

  const num1 = Number(value1);
  const num2 = Number(value2);

  if (!isNaN(num1) && !isNaN(num2)) {
    return num1 - num2;
  }

  return String(value1).localeCompare(String(value2));
}

/**
 * Check if a value is empty
 */
function isValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if a value starts with a search value
 */
function valueStartsWith(
  value: unknown,
  searchValue: string | number | boolean | string[]
): boolean {
  if (value == null) return false;
  return String(value).toLowerCase().startsWith(String(searchValue).toLowerCase());
}

/**
 * Check if a value ends with a search value
 */
function valueEndsWith(
  value: unknown,
  searchValue: string | number | boolean | string[]
): boolean {
  if (value == null) return false;
  return String(value).toLowerCase().endsWith(String(searchValue).toLowerCase());
}

// ============================================================================
// FORM-LEVEL EVALUATION
// ============================================================================

/**
 * Evaluate all conditional logic for a form
 */
export function evaluateFormConditions(
  context: EvaluationContext
): FormConditionalState {
  const state: FormConditionalState = {
    fields: new Map(),
    pages: new Map(),
    activePageIndices: [],
    errors: [],
  };

  // Evaluate field conditions
  for (const field of context.fields) {
    try {
      const result = evaluateFieldConditions(field, context.responses);
      state.fields.set(field.id, result);
    } catch (error) {
      state.errors.push(`Error evaluating field ${field.id}: ${error}`);
    }
  }

  // Evaluate page conditions
  for (const page of context.form.pages) {
    try {
      const result = evaluatePageConditions(page, context.responses);
      state.pages.set(page.id, result);

      if (result.shouldShow && !result.shouldSkip) {
        state.activePageIndices.push(result.pageIndex);
      }
    } catch (error) {
      state.errors.push(`Error evaluating page ${page.id}: ${error}`);
    }
  }

  // Sort active pages by index
  state.activePageIndices.sort((a, b) => a - b);

  return state;
}

/**
 * Evaluate conditions for a single field
 */
export function evaluateFieldConditions(
  field: FormFieldConfig,
  responses: Map<string, FieldResponse>
): ConditionalEvaluationResult {
  const result: ConditionalEvaluationResult = {
    fieldId: field.id,
    isVisible: true,
    isRequired: field.validation?.required ?? false,
    isDisabled: false,
  };

  // If no conditional logic, return defaults
  if (!field.conditionalLogic?.enabled) {
    return result;
  }

  // Evaluate visibility
  result.isVisible = evaluateConditions(field.conditionalLogic, responses);

  // Hidden fields are not required
  if (!result.isVisible) {
    result.isRequired = false;
  }

  return result;
}

/**
 * Evaluate conditions for a page (multi-step forms)
 */
export function evaluatePageConditions(
  page: FormPage,
  responses: Map<string, FieldResponse>
): PageEvaluationResult {
  const result: PageEvaluationResult = {
    pageId: page.id,
    pageIndex: page.order,
    shouldShow: true,
    shouldSkip: false,
  };

  // If no conditional logic, show the page
  if (!page.conditionalLogic?.enabled) {
    return result;
  }

  // Evaluate page visibility
  result.shouldShow = evaluateConditions(page.conditionalLogic, responses);
  result.shouldSkip = !result.shouldShow;

  return result;
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Get the next visible page index
 */
export function getNextVisiblePage(
  currentPageIndex: number,
  state: FormConditionalState
): number | null {
  const activePages = state.activePageIndices;
  const currentPosition = activePages.indexOf(currentPageIndex);

  if (currentPosition === -1) {
    // Current page not in active list, find next available
    const nextPage = activePages.find((idx) => idx > currentPageIndex);
    return nextPage ?? null;
  }

  if (currentPosition < activePages.length - 1) {
    return activePages[currentPosition + 1];
  }

  return null; // No next page
}

/**
 * Get the previous visible page index
 */
export function getPreviousVisiblePage(
  currentPageIndex: number,
  state: FormConditionalState
): number | null {
  const activePages = state.activePageIndices;
  const currentPosition = activePages.indexOf(currentPageIndex);

  if (currentPosition === -1) {
    // Current page not in active list, find previous available
    const previousPages = activePages.filter((idx) => idx < currentPageIndex);
    return previousPages.length > 0 ? previousPages[previousPages.length - 1] : null;
  }

  if (currentPosition > 0) {
    return activePages[currentPosition - 1];
  }

  return null; // No previous page
}

/**
 * Check if we're on the last visible page
 */
export function isLastVisiblePage(
  currentPageIndex: number,
  state: FormConditionalState
): boolean {
  const activePages = state.activePageIndices;
  return (
    activePages.length > 0 &&
    currentPageIndex === activePages[activePages.length - 1]
  );
}

/**
 * Check if we're on the first visible page
 */
export function isFirstVisiblePage(
  currentPageIndex: number,
  state: FormConditionalState
): boolean {
  const activePages = state.activePageIndices;
  return activePages.length > 0 && currentPageIndex === activePages[0];
}

/**
 * Calculate progress percentage based on visible pages
 */
export function calculateProgress(
  currentPageIndex: number,
  state: FormConditionalState
): number {
  const activePages = state.activePageIndices;
  if (activePages.length === 0) return 100;

  const currentPosition = activePages.indexOf(currentPageIndex);
  if (currentPosition === -1) return 0;

  return Math.round(((currentPosition + 1) / activePages.length) * 100);
}

// ============================================================================
// VALIDATION WITH CONDITIONS
// ============================================================================

/**
 * Get all fields that need validation (visible and required)
 */
export function getRequiredVisibleFields(
  fields: FormFieldConfig[],
  state: FormConditionalState
): FormFieldConfig[] {
  return fields.filter((field) => {
    const evaluation = state.fields.get(field.id);
    return evaluation?.isVisible && evaluation?.isRequired;
  });
}

/**
 * Validate a page considering conditional logic
 */
export function validatePageWithConditions(
  pageIndex: number,
  fields: FormFieldConfig[],
  responses: Map<string, FieldResponse>,
  state: FormConditionalState
): { isValid: boolean; errors: Map<string, string[]> } {
  const errors = new Map<string, string[]>();

  // Get fields on this page that are visible
  const pageFields = fields.filter(
    (f) => f.pageIndex === pageIndex && state.fields.get(f.id)?.isVisible
  );

  for (const field of pageFields) {
    const evaluation = state.fields.get(field.id);
    if (!evaluation?.isVisible) continue;

    const response = responses.get(field.id);
    const fieldErrors: string[] = [];

    // Check required
    if (evaluation.isRequired && isValueEmpty(response?.value)) {
      fieldErrors.push(
        field.validation?.customMessage || `${field.label} is required`
      );
    }

    // Additional validation can be added here

    if (fieldErrors.length > 0) {
      errors.set(field.id, fieldErrors);
    }
  }

  return {
    isValid: errors.size === 0,
    errors,
  };
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create a responses map from an array of field responses
 */
export function createResponsesMap(
  responses: FieldResponse[]
): Map<string, FieldResponse> {
  const map = new Map<string, FieldResponse>();
  for (const response of responses) {
    map.set(response.fieldId, response);
  }
  return map;
}

/**
 * Get visible responses only (filters out hidden field responses)
 */
export function getVisibleResponses(
  responses: FieldResponse[],
  state: FormConditionalState
): FieldResponse[] {
  return responses.filter((response) => {
    const evaluation = state.fields.get(response.fieldId);
    return evaluation?.isVisible ?? true;
  });
}

// ============================================================================
// DEPENDENCY TRACKING
// ============================================================================

/**
 * Build a dependency graph for conditional fields
 */
export function buildDependencyGraph(
  fields: FormFieldConfig[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const field of fields) {
    if (!field.conditionalLogic?.enabled) continue;

    // Initialize dependent set for this field
    if (!graph.has(field.id)) {
      graph.set(field.id, new Set());
    }

    // Track which fields this field depends on
    for (const condition of field.conditionalLogic.conditions) {
      // Add this field as dependent on the source field
      if (!graph.has(condition.fieldId)) {
        graph.set(condition.fieldId, new Set());
      }
      graph.get(condition.fieldId)!.add(field.id);
    }
  }

  return graph;
}

/**
 * Get all fields that depend on a given field (direct + transitive)
 */
export function getDependentFields(
  fieldId: string,
  dependencyGraph: Map<string, Set<string>>
): Set<string> {
  const dependents = new Set<string>();
  const queue = [fieldId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const directDependents = dependencyGraph.get(current);
    if (directDependents) {
      for (const dependent of directDependents) {
        dependents.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return dependents;
}

/**
 * Detect circular dependencies in conditional logic
 */
export function detectCircularDependencies(
  fields: FormFieldConfig[]
): string[] {
  const errors: string[] = [];
  const graph = buildDependencyGraph(fields);

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(fieldId: string, path: string[] = []): boolean {
    if (recursionStack.has(fieldId)) {
      errors.push(
        `Circular dependency detected: ${[...path, fieldId].join(' → ')}`
      );
      return true;
    }

    if (visited.has(fieldId)) return false;

    visited.add(fieldId);
    recursionStack.add(fieldId);

    const dependents = graph.get(fieldId);
    if (dependents) {
      for (const dependent of dependents) {
        if (hasCycle(dependent, [...path, fieldId])) {
          return true;
        }
      }
    }

    recursionStack.delete(fieldId);
    return false;
  }

  for (const fieldId of graph.keys()) {
    if (!visited.has(fieldId)) {
      hasCycle(fieldId);
    }
  }

  return errors;
}
