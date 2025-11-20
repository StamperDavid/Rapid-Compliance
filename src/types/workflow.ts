import { Timestamp } from 'firebase/firestore';
import { EntityFilter } from './entity';

/**
 * Workflow
 * Automation workflows (like Zapier/Make)
 */
export interface Workflow {
  id: string;
  workspaceId: string;
  
  // Basic info
  name: string;
  description?: string;
  icon?: string;
  folder?: string; // For organization
  
  // Trigger
  trigger: WorkflowTrigger;
  
  // Conditions (optional filters)
  conditions?: WorkflowCondition[];
  conditionOperator?: 'and' | 'or';
  
  // Actions
  actions: WorkflowAction[];
  
  // Settings
  settings: WorkflowSettings;
  
  // Permissions
  permissions: {
    canView: string[]; // roles
    canEdit: string[];
    canExecute: string[];
  };
  
  // Execution stats
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunAt?: Timestamp;
    lastRunStatus?: 'success' | 'failed';
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  status: 'active' | 'paused' | 'draft' | 'archived';
  version: number;
}

/**
 * Workflow Trigger
 * What starts the workflow
 */
export type WorkflowTrigger =
  | EntityTrigger
  | ScheduleTrigger
  | WebhookTrigger
  | ManualTrigger
  | AIAgentTrigger
  | FormTrigger
  | EmailTrigger;

export interface BaseTrigger {
  type: string;
  id: string;
  name: string;
}

export interface EntityTrigger extends BaseTrigger {
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  schemaId: string;
  
  // Optional field-specific triggers
  specificFields?: string[]; // Only trigger if these fields change
  
  // Filter which records trigger
  filters?: EntityFilter[];
}

export interface ScheduleTrigger extends BaseTrigger {
  type: 'schedule';
  
  schedule: {
    type: 'cron' | 'interval';
    cron?: string; // Cron expression
    interval?: {
      value: number;
      unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
    };
    timezone?: string;
  };
  
  // What to process when triggered
  targetSchema?: string;
  filters?: EntityFilter[];
}

export interface WebhookTrigger extends BaseTrigger {
  type: 'webhook';
  
  webhookUrl: string; // Generated webhook URL
  secret?: string; // For verification
  method: 'GET' | 'POST' | 'PUT';
  
  // Request validation
  requireAuth: boolean;
  allowedIPs?: string[];
}

export interface ManualTrigger extends BaseTrigger {
  type: 'manual';
  
  // Can be triggered by users or via API
  requireConfirmation: boolean;
  confirmationMessage?: string;
  
  // Input parameters
  parameters?: WorkflowParameter[];
}

export interface AIAgentTrigger extends BaseTrigger {
  type: 'ai_agent';
  
  agentId: string;
  
  // Trigger conditions
  triggerOn: 'conversation_end' | 'keyword_detected' | 'intent_classified' | 'custom';
  keywords?: string[];
  intents?: string[];
}

export interface FormTrigger extends BaseTrigger {
  type: 'form.submitted';
  
  formId?: string; // Specific form or any form
  schemaId: string; // Form's target schema
}

export interface EmailTrigger extends BaseTrigger {
  type: 'email.received';
  
  emailAddress: string; // Dedicated email for this workflow
  
  // Filters
  fromAddresses?: string[];
  subjectContains?: string[];
  bodyContains?: string[];
}

export interface WorkflowParameter {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
}

/**
 * Workflow Condition
 * Gate actions based on conditions
 */
export interface WorkflowCondition {
  id: string;
  
  // What to check
  source: ConditionSource;
  field: string;
  
  // Comparison
  operator: ConditionOperator;
  value: any;
  
  // For complex conditions
  logicOperator?: 'and' | 'or';
}

export type ConditionSource = 'trigger_data' | 'entity' | 'variable' | 'date' | 'user';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_true'
  | 'is_false'
  | 'in_list'
  | 'not_in_list'
  | 'between'
  | 'exists'
  | 'not_exists';

/**
 * Workflow Action
 * What the workflow does
 */
export type WorkflowAction =
  | CreateEntityAction
  | UpdateEntityAction
  | DeleteEntityAction
  | SendEmailAction
  | SendSMSAction
  | SendSlackAction
  | HTTPRequestAction
  | AIAgentAction
  | DelayAction
  | ConditionalBranchAction
  | LoopAction
  | CloudFunctionAction
  | CreateTaskAction;

export interface BaseAction {
  id: string;
  type: string;
  name: string;
  
  // Continue on error or stop workflow
  continueOnError: boolean;
  
  // Retry settings
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
  };
}

export interface CreateEntityAction extends BaseAction {
  type: 'create_entity';
  
  schemaId: string;
  
  // Field mappings
  fieldMappings: FieldMapping[];
}

export interface UpdateEntityAction extends BaseAction {
  type: 'update_entity';
  
  schemaId: string;
  
  // Which record(s) to update
  targetRecord: 'trigger' | 'query' | 'specific';
  entityId?: string; // For specific
  query?: EntityFilter[]; // For query
  
  // Field mappings
  fieldMappings: FieldMapping[];
}

export interface DeleteEntityAction extends BaseAction {
  type: 'delete_entity';
  
  schemaId: string;
  
  // Which record(s) to delete
  targetRecord: 'trigger' | 'query' | 'specific';
  entityId?: string;
  query?: EntityFilter[];
  
  // Soft delete or hard delete
  softDelete: boolean;
}

export interface FieldMapping {
  targetField: string;
  
  // Value source
  source: 'static' | 'trigger' | 'variable' | 'function' | 'ai';
  
  // Static value
  staticValue?: any;
  
  // Dynamic value
  sourceField?: string; // From trigger data or previous action
  
  // Transformation
  transform?: FieldTransform;
  
  // AI generation
  aiPrompt?: string;
}

export interface FieldTransform {
  type: 'uppercase' | 'lowercase' | 'trim' | 'format' | 'calculate' | 'custom';
  format?: string; // For format type
  formula?: string; // For calculate type
  customFunction?: string; // Function name
}

export interface SendEmailAction extends BaseAction {
  type: 'send_email';
  
  to: string[]; // Email addresses or field references
  cc?: string[];
  bcc?: string[];
  
  subject: string;
  body: string; // Supports template variables
  bodyType: 'text' | 'html';
  
  // Attachments
  attachments?: EmailAttachment[];
  
  // From address (if custom domain configured)
  from?: string;
  replyTo?: string;
}

export interface EmailAttachment {
  source: 'field' | 'url' | 'cloud_storage';
  value: string; // Field name, URL, or storage path
}

export interface SendSMSAction extends BaseAction {
  type: 'send_sms';
  
  to: string; // Phone number or field reference
  message: string;
  
  // SMS provider
  provider?: 'twilio' | 'vonage' | 'default';
}

export interface SendSlackAction extends BaseAction {
  type: 'send_slack';
  
  channel: string; // Channel ID or name
  message: string;
  
  // Message formatting
  blocks?: any[]; // Slack Block Kit
  
  // Mentions
  mentions?: string[]; // User IDs
}

export interface HTTPRequestAction extends BaseAction {
  type: 'http_request';
  
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  
  // Headers
  headers?: Record<string, string>;
  
  // Body
  body?: string | Record<string, any>;
  bodyType?: 'json' | 'form' | 'raw';
  
  // Auth
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
    credentials?: Record<string, string>;
  };
  
  // Response handling
  saveResponseAs?: string; // Variable name
}

export interface AIAgentAction extends BaseAction {
  type: 'ai_agent';
  
  agentId: string;
  
  // Input
  prompt: string; // Can reference trigger data
  context?: Record<string, any>;
  
  // Output
  saveResponseAs: string; // Variable name
  
  // Options
  awaitResponse: boolean; // Wait for response or run async
}

export interface DelayAction extends BaseAction {
  type: 'delay';
  
  duration: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days';
  };
  
  // Or delay until specific time
  until?: {
    type: 'specific_time' | 'field_value';
    time?: string; // ISO timestamp
    field?: string; // Field reference for date
  };
}

export interface ConditionalBranchAction extends BaseAction {
  type: 'conditional_branch';
  
  branches: ConditionalBranch[];
  defaultBranch?: WorkflowAction[]; // Else branch
}

export interface ConditionalBranch {
  id: string;
  name: string;
  conditions: WorkflowCondition[];
  conditionOperator: 'and' | 'or';
  actions: WorkflowAction[];
}

export interface LoopAction extends BaseAction {
  type: 'loop';
  
  // What to loop over
  iterateOver: 'query_results' | 'array_field' | 'range';
  
  // Query (for query_results)
  schemaId?: string;
  query?: EntityFilter[];
  
  // Array field (for array_field)
  arrayField?: string;
  
  // Range (for range)
  range?: {
    start: number;
    end: number;
    step?: number;
  };
  
  // Actions to run in loop
  actions: WorkflowAction[];
  
  // Loop settings
  maxIterations?: number; // Prevent infinite loops
  breakOn?: WorkflowCondition; // Break loop if condition met
}

export interface CloudFunctionAction extends BaseAction {
  type: 'cloud_function';
  
  functionName: string;
  
  // Input
  parameters?: Record<string, any>;
  
  // Output
  saveResponseAs?: string;
}

export interface CreateTaskAction extends BaseAction {
  type: 'create_task';
  
  assignTo: string; // User ID or field reference
  title: string;
  description?: string;
  dueDate?: string; // ISO date or field reference
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  
  // Link to entity
  linkedEntity?: {
    schemaId: string;
    entityId: string;
  };
}

/**
 * Workflow Settings
 */
export interface WorkflowSettings {
  // Execution
  timeout: number; // seconds
  maxConcurrentRuns?: number;
  queueStrategy?: 'parallel' | 'sequential';
  
  // Error handling
  onError: 'stop' | 'continue' | 'retry' | 'notify';
  errorNotificationEmail?: string;
  
  // Logging
  logLevel: 'none' | 'errors' | 'all';
  retentionDays: number; // How long to keep execution logs
  
  // Rate limiting
  rateLimit?: {
    enabled: boolean;
    maxRunsPerHour?: number;
    maxRunsPerDay?: number;
  };
}

/**
 * Workflow Execution
 * Record of a workflow run
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  
  // Trigger info
  triggeredBy: string; // 'system', 'user:userId', 'webhook', etc.
  triggerData: any; // Data that triggered the workflow
  
  // Execution
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Timestamp;
  completedAt?: Timestamp;
  duration?: number; // milliseconds
  
  // Actions executed
  actionResults: ActionResult[];
  
  // Variables/context
  variables: Record<string, any>;
  
  // Error info
  error?: {
    message: string;
    stack?: string;
    actionId?: string; // Which action failed
  };
  
  // Metadata
  retryCount: number;
  retryOf?: string; // Parent execution ID if this is a retry
}

export interface ActionResult {
  actionId: string;
  actionType: string;
  actionName: string;
  
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: Timestamp;
  completedAt?: Timestamp;
  duration?: number;
  
  // Output
  output?: any;
  
  // Error
  error?: {
    message: string;
    details?: any;
  };
  
  // Retry info
  retryCount?: number;
}

/**
 * Workflow Template
 * Pre-built workflows for common use cases
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // Preview
  icon: string;
  thumbnail?: string;
  
  // Template data
  workflow: Partial<Workflow>;
  
  // Requirements
  requiredSchemas?: string[]; // Schema types needed
  requiredIntegrations?: string[]; // Integrations needed
  
  // Metadata
  isPopular: boolean;
  usageCount: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  
  createdAt: Timestamp;
}

