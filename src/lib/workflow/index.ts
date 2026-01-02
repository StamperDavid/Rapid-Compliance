/**
 * Workflow Automation Module - Public API
 * 
 * SOVEREIGN CORPORATE BRAIN - INTELLIGENT AUTOMATION
 * 
 * This module exports the complete workflow automation system.
 * 
 * EXPORTS:
 * - Types and interfaces
 * - Validation schemas
 * - Workflow Engine
 * - Workflow Coordinator
 * - Workflow Service
 */

// Types
export type {
  // Core types
  Workflow,
  WorkflowStatus,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowAction,
  WorkflowActionType,
  WorkflowTrigger,
  WorkflowTriggerType,
  WorkflowSettings,
  WorkflowStats,
  
  // Trigger types
  TriggerCondition,
  TriggerOperator,
  TriggerSchedule,
  
  // Action types
  ActionConfig,
  ActionExecutionResult,
  RetryConfig,
  
  // Validation types
  WorkflowValidationResult,
  ValidationError,
  ValidationWarning,
  WorkflowTestResult,
} from './types';

// Validation
export {
  // Schemas
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ExecuteWorkflowSchema,
  WorkflowFilterSchema,
  WorkflowTriggerSchema,
  WorkflowActionSchema,
  WorkflowSettingsSchema,
  TriggerConditionSchema,
  TriggerOperatorSchema,
  
  // Validation functions
  validateWorkflow,
  validateWorkflowUpdate,
  validateWorkflowExecution,
  
  // Inferred types
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type ExecuteWorkflowInput,
  type WorkflowFilterInput,
  type EmailActionConfig,
  type TaskActionConfig,
  type DealActionConfig,
  type NotificationActionConfig,
  type WebhookActionConfig,
  type WaitActionConfig,
} from './validation';

// Engine
export {
  WorkflowEngine,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
} from './workflow-engine';

// Coordinator
export {
  WorkflowCoordinator,
  type WorkflowCoordinatorConfig,
} from './workflow-coordinator';

// Service
export {
  WorkflowService,
  getWorkflowService,
  
  // Convenience functions
  createWorkflow,
  getWorkflow,
  getWorkflows,
  updateWorkflow,
  setWorkflowStatus,
  deleteWorkflow,
} from './workflow-service';
