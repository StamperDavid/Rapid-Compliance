/**
 * Workflow Automation Types
 * 
 * SOVEREIGN CORPORATE BRAIN - INTELLIGENT AUTOMATION MODULE
 * 
 * This module defines the type system for workflow automation that powers
 * intelligent, event-driven sales processes.
 * 
 * CORE CONCEPTS:
 * - Workflows: Automated sequences triggered by events
 * - Triggers: Conditions that activate workflows (deal score changes, etc.)
 * - Actions: Automated tasks executed when triggered (send email, create task)
 * - Rules: Logic for evaluating when to trigger workflows
 * 
 * INTEGRATION:
 * - Signal Bus for event detection
 * - Deal Scoring for intelligent triggers
 * - Email Writer for automated outreach
 * - CRM for task creation and updates
 */

// Use conditional type to support both client and admin Timestamp
type FirestoreTimestamp = {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
};

import type { EmailType } from '@/lib/email-writer/email-templates';

// ============================================================================
// TRIGGER TYPES
// ============================================================================

/**
 * Workflow trigger types
 * 
 * These define the events that can activate a workflow
 */
export type WorkflowTriggerType =
  // Deal Score Triggers
  | 'deal.score.changed'          // Any score change
  | 'deal.score.increased'        // Score went up
  | 'deal.score.decreased'        // Score went down
  | 'deal.tier.changed'           // Tier changed (hot/warm/cold/at-risk)
  | 'deal.at_risk.detected'       // Deal became at-risk
  | 'deal.hot.detected'           // Deal became hot
  
  // Deal Stage Triggers
  | 'deal.stage.changed'          // Stage progression
  | 'deal.stage.stuck'            // Deal stuck in stage too long
  | 'deal.stage.regressed'        // Deal moved backwards
  
  // Deal Activity Triggers
  | 'deal.activity.low'           // Low engagement detected
  | 'deal.activity.high'          // High engagement detected
  | 'deal.no_activity'            // No activity in X days
  
  // Deal Value Triggers
  | 'deal.value.increased'        // Deal value went up
  | 'deal.value.decreased'        // Deal value went down
  | 'deal.high_value.detected'    // Deal exceeded value threshold
  
  // Deal Risk Triggers
  | 'deal.risk.critical'          // Critical risk factor detected
  | 'deal.risk.high'              // High risk factor detected
  | 'deal.close_date.approaching' // Close date within X days
  | 'deal.close_date.passed'      // Close date passed without close
  
  // Time-based Triggers
  | 'schedule.daily'              // Run daily at specific time
  | 'schedule.weekly'             // Run weekly on specific day
  | 'schedule.monthly'            // Run monthly on specific date
  
  // Manual Triggers
  | 'manual';                     // Manually triggered by user

/**
 * Trigger configuration
 * 
 * Defines the specific conditions for a trigger to fire
 */
export interface WorkflowTrigger {
  id: string;
  type: WorkflowTriggerType;
  
  // Trigger conditions
  conditions: TriggerCondition[];
  
  // When multiple conditions exist, how to combine them
  conditionLogic: 'AND' | 'OR';
  
  // Optional schedule for time-based triggers
  schedule?: TriggerSchedule;
  
  // Metadata
  name: string;
  description: string;
}

/**
 * Trigger condition
 * 
 * Individual condition that must be met
 */
export interface TriggerCondition {
  field: string;                  // Field to evaluate (e.g., 'score', 'tier', 'stage')
  operator: TriggerOperator;      // Comparison operator
  value: string | number | boolean | string[]; // Value to compare against
}

/**
 * Trigger operators
 */
export type TriggerOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'changed_from'
  | 'changed_to';

/**
 * Schedule configuration for time-based triggers
 */
export interface TriggerSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;                   // Time in HH:MM format (24-hour)
  dayOfWeek?: number;             // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number;            // 1-31 for monthly
  timezone?: string;              // IANA timezone (default: UTC)
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * Workflow action types
 * 
 * These define the automated tasks that can be executed
 */
export type WorkflowActionType =
  // Email Actions
  | 'email.send'                  // Send email using Email Writer
  | 'email.generate'              // Generate email draft (no send)
  | 'email.sequence.add'          // Add to email sequence
  
  // Task Actions
  | 'task.create'                 // Create task for sales rep
  | 'task.assign'                 // Assign existing task
  | 'task.update'                 // Update task properties
  
  // Deal Actions
  | 'deal.stage.change'           // Move deal to different stage
  | 'deal.tag.add'                // Add tag to deal
  | 'deal.tag.remove'             // Remove tag from deal
  | 'deal.update'                 // Update deal properties
  
  // Notification Actions
  | 'notification.send'           // Send in-app notification
  | 'notification.slack'          // Send Slack message
  | 'notification.email'          // Send notification email
  
  // CRM Actions
  | 'activity.create'             // Log activity
  | 'note.create'                 // Create note on deal
  | 'reminder.create'             // Create reminder
  
  // Scoring Actions
  | 'score.recalculate'           // Recalculate deal score
  | 'forecast.update'             // Update revenue forecast
  
  // Webhook Actions
  | 'webhook.call'                // Call external webhook
  
  // Wait Actions
  | 'wait.delay'                  // Wait X hours/days before next action
  | 'wait.until'                  // Wait until specific condition
  
  // Custom Actions
  | 'custom';                     // Custom action handler

/**
 * Workflow action configuration
 */
export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  
  // Action-specific configuration
  config: ActionConfig;
  
  // Order in workflow (for multi-action workflows)
  order: number;
  
  // Whether to continue on failure
  continueOnError: boolean;
  
  // Retry configuration
  retry?: RetryConfig;
  
  // Metadata
  name: string;
  description: string;
}

/**
 * Action configuration (type-specific)
 */
export type ActionConfig =
  | EmailActionConfig
  | TaskActionConfig
  | DealActionConfig
  | NotificationActionConfig
  | WebhookActionConfig
  | WaitActionConfig
  | Record<string, unknown>; // For custom actions

/**
 * Email action configuration
 */
export interface EmailActionConfig {
  emailType: EmailType;
  recipientField?: string;        // Field containing recipient email
  recipientEmail?: string;        // Static recipient email
  tone?: 'professional' | 'casual' | 'consultative' | 'urgent' | 'friendly';
  length?: 'short' | 'medium' | 'long';
  includeCompetitive?: boolean;
  includeSocialProof?: boolean;
  customInstructions?: string;
  autoSend?: boolean;             // If false, generate draft only
}

/**
 * Task action configuration
 */
export interface TaskActionConfig {
  title: string;
  description?: string;
  dueInDays?: number;             // Days from now
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignToField?: string;         // Field containing user ID to assign to
  assignToUserId?: string;        // Static user ID
  taskType?: string;              // Task category
}

/**
 * Deal action configuration
 */
export interface DealActionConfig {
  field: string;                  // Field to update
  value: string | number | boolean;
  operation?: 'set' | 'increment' | 'decrement' | 'append';
}

/**
 * Notification action configuration
 */
export interface NotificationActionConfig {
  channel: 'in_app' | 'slack' | 'email';
  message: string;
  title?: string;
  priority?: 'low' | 'medium' | 'high';
  recipientField?: string;
  recipientId?: string;
  slackChannel?: string;          // For Slack notifications
  emailTemplate?: string;         // For email notifications
}

/**
 * Webhook action configuration
 */
export interface WebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeout?: number;               // Timeout in milliseconds
}

/**
 * Wait action configuration
 */
export interface WaitActionConfig {
  type: 'delay' | 'until';
  delayHours?: number;            // For delay type
  delayDays?: number;             // For delay type
  condition?: TriggerCondition;   // For until type
  maxWaitDays?: number;           // Maximum wait time
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;            // Maximum retry attempts
  delayMs: number;                // Delay between retries
  backoffMultiplier?: number;     // Exponential backoff multiplier
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

/**
 * Workflow status
 */
export type WorkflowStatus = 'active' | 'paused' | 'draft' | 'archived';

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Workflow definition
 *
 * Complete workflow configuration
 */
export interface Workflow {
  id: string;

  // Basic info
  name: string;
  description: string;
  status: WorkflowStatus;
  
  // Trigger configuration
  trigger: WorkflowTrigger;
  
  // Actions to execute
  actions: WorkflowAction[];
  
  // Workflow settings
  settings: WorkflowSettings;
  
  // Metadata
  createdBy: string;              // User ID
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  
  // Statistics
  stats: WorkflowStats;
  
  // Tags for organization
  tags?: string[];
}

/**
 * Workflow settings
 */
export interface WorkflowSettings {
  // Execution limits
  maxExecutionsPerDay?: number;   // Prevent runaway workflows
  maxExecutionsPerDeal?: number;  // Max times per deal
  
  // Timing
  cooldownMinutes?: number;       // Min time between executions
  executeOnWeekends?: boolean;    // Whether to run on weekends
  executeOnHolidays?: boolean;    // Whether to run on holidays
  
  // Scope
  applyToNewDealsOnly?: boolean;  // Only apply to deals created after workflow
  dealFilters?: TriggerCondition[]; // Additional deal filters
  
  // Notifications
  notifyOnSuccess?: boolean;      // Notify creator on success
  notifyOnFailure?: boolean;      // Notify creator on failure
  notificationRecipients?: string[]; // User IDs to notify
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  totalExecutions: number;        // Total times executed
  successfulExecutions: number;   // Successful executions
  failedExecutions: number;       // Failed executions
  averageExecutionTimeMs: number; // Average execution time
  lastExecutedAt?: FirestoreTimestamp;     // Last execution time
  lastSuccessAt?: FirestoreTimestamp;      // Last successful execution
  lastFailureAt?: FirestoreTimestamp;      // Last failed execution
}

/**
 * Workflow execution record
 *
 * Track individual workflow executions
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;

  // Execution context
  dealId?: string;                // Deal that triggered the workflow
  triggeredBy: 'event' | 'schedule' | 'manual';
  triggerData: Record<string, unknown>; // Data that triggered the workflow
  
  // Execution status
  status: WorkflowExecutionStatus;
  startedAt: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
  durationMs?: number;
  
  // Results
  actionsExecuted: ActionExecutionResult[];
  
  // Error tracking
  error?: string;
  errorStack?: string;
  
  // Metadata
  executedBy?: string;            // User ID for manual executions
}

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  actionId: string;
  actionType: WorkflowActionType;
  status: 'success' | 'failed' | 'skipped';
  startedAt: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
  durationMs?: number;
  result?: Record<string, unknown>; // Action-specific result data
  error?: string;
  retryCount?: number;
}

// ============================================================================
// VALIDATION & TESTING
// ============================================================================

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Workflow test result
 */
export interface WorkflowTestResult {
  success: boolean;
  workflowId: string;
  executionId: string;
  triggerMatched: boolean;
  actionsExecuted: number;
  duration: number;
  errors: string[];
  results: Record<string, unknown>;
}
