/**
 * Workflow Executor
 * Extracted to break circular dependencies between workflow-engine and triggers
 */

import type { Workflow } from '@/types/workflow';
import type { WorkflowExecution } from './workflow-engine';

/**
 * Execute workflow
 * This is a minimal wrapper that delegates to the actual implementation
 * Helps break circular dependencies
 */
export async function executeWorkflow(
  workflow: Workflow,
  triggerData: any
): Promise<WorkflowExecution> {
  // Dynamic import to avoid circular dependency
  const { executeWorkflowImpl } = await import('./workflow-engine');
  return executeWorkflowImpl(workflow, triggerData);
}
