/**
 * ReactFlow Workflow Builder Types
 *
 * Type definitions for the visual node-graph workflow editor.
 * Maps between ReactFlow node/edge data and the Workflow domain types.
 */

/** Categories for palette items */
export type PaletteCategory = 'Triggers' | 'Communication' | 'Data' | 'AI' | 'Flow Control' | 'External' | 'Productivity';

/** Visual node categories (determines color/accent) */
export type FlowNodeCategory = 'trigger' | 'action' | 'condition' | 'delay';

/** Data stored inside each ReactFlow node */
export interface FlowNodeData {
  /** Display label */
  label: string;
  /** The workflow action/trigger type string (e.g. 'send_email', 'entity.created') */
  actionType: string;
  /** Visual category for coloring */
  category: FlowNodeCategory;
  /** Icon string (emoji) */
  icon: string;
  /** Short description / config summary */
  description: string;
  /** Full configuration object for this step */
  config: Record<string, unknown>;
  /** Whether this node is currently selected */
  selected?: boolean;
}

/** Palette item definition for the sidebar */
export interface FlowPaletteItem {
  id: string;
  /** The workflow action/trigger type string */
  actionType: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon (emoji) */
  icon: string;
  /** Which palette category section it belongs to */
  paletteCategory: PaletteCategory;
  /** Visual node category (determines which custom node type to use) */
  nodeCategory: FlowNodeCategory;
}

/** Custom ReactFlow node type names */
export type FlowNodeType = 'triggerNode' | 'actionNode' | 'conditionNode' | 'delayNode';

/** Map from FlowNodeCategory to FlowNodeType */
export function getNodeType(category: FlowNodeCategory): FlowNodeType {
  switch (category) {
    case 'trigger':
      return 'triggerNode';
    case 'condition':
      return 'conditionNode';
    case 'delay':
      return 'delayNode';
    case 'action':
    default:
      return 'actionNode';
  }
}

// =====================================================================
// Palette Definitions
// =====================================================================

export const TRIGGER_ITEMS: FlowPaletteItem[] = [
  {
    id: 'trigger-entity-created',
    actionType: 'entity.created',
    name: 'Record Created',
    description: 'When a new record is created',
    icon: '✨',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-entity-updated',
    actionType: 'entity.updated',
    name: 'Record Updated',
    description: 'When a record is updated',
    icon: '🔄',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-entity-deleted',
    actionType: 'entity.deleted',
    name: 'Record Deleted',
    description: 'When a record is deleted',
    icon: '🗑',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-schedule',
    actionType: 'schedule',
    name: 'Schedule',
    description: 'Run on a cron schedule or interval',
    icon: '⏰',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-webhook',
    actionType: 'webhook',
    name: 'Webhook',
    description: 'Triggered by an incoming HTTP request',
    icon: '🔗',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-manual',
    actionType: 'manual',
    name: 'Manual',
    description: 'Triggered manually by a user',
    icon: '👆',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-ai-agent',
    actionType: 'ai_agent',
    name: 'AI Agent',
    description: 'Triggered by AI agent activity',
    icon: '🤖',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-form',
    actionType: 'form.submitted',
    name: 'Form Submitted',
    description: 'When a form is submitted',
    icon: '📝',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
  {
    id: 'trigger-email',
    actionType: 'email.received',
    name: 'Email Received',
    description: 'When an email is received',
    icon: '📨',
    paletteCategory: 'Triggers',
    nodeCategory: 'trigger',
  },
];

export const ACTION_ITEMS: FlowPaletteItem[] = [
  // Communication
  {
    id: 'action-send-email',
    actionType: 'send_email',
    name: 'Send Email',
    description: 'Send an email to recipients',
    icon: '📧',
    paletteCategory: 'Communication',
    nodeCategory: 'action',
  },
  {
    id: 'action-send-sms',
    actionType: 'send_sms',
    name: 'Send SMS',
    description: 'Send a text message',
    icon: '💬',
    paletteCategory: 'Communication',
    nodeCategory: 'action',
  },
  {
    id: 'action-send-slack',
    actionType: 'send_slack',
    name: 'Send Slack',
    description: 'Post a message to Slack',
    icon: '💼',
    paletteCategory: 'Communication',
    nodeCategory: 'action',
  },
  // Data
  {
    id: 'action-create-entity',
    actionType: 'create_entity',
    name: 'Create Record',
    description: 'Create a new CRM record',
    icon: '➕',
    paletteCategory: 'Data',
    nodeCategory: 'action',
  },
  {
    id: 'action-update-entity',
    actionType: 'update_entity',
    name: 'Update Record',
    description: 'Update an existing record',
    icon: '✏️',
    paletteCategory: 'Data',
    nodeCategory: 'action',
  },
  {
    id: 'action-delete-entity',
    actionType: 'delete_entity',
    name: 'Delete Record',
    description: 'Delete a record',
    icon: '🗑️',
    paletteCategory: 'Data',
    nodeCategory: 'action',
  },
  // External
  {
    id: 'action-http-request',
    actionType: 'http_request',
    name: 'HTTP Request',
    description: 'Make an external API call',
    icon: '🌐',
    paletteCategory: 'External',
    nodeCategory: 'action',
  },
  {
    id: 'action-cloud-function',
    actionType: 'cloud_function',
    name: 'Cloud Function',
    description: 'Run a cloud function',
    icon: '☁️',
    paletteCategory: 'External',
    nodeCategory: 'action',
  },
  // AI
  {
    id: 'action-ai-agent',
    actionType: 'ai_agent',
    name: 'AI Agent',
    description: 'Run an AI agent action',
    icon: '🤖',
    paletteCategory: 'AI',
    nodeCategory: 'action',
  },
  // Productivity
  {
    id: 'action-create-task',
    actionType: 'create_task',
    name: 'Create Task',
    description: 'Create a task for a team member',
    icon: '✅',
    paletteCategory: 'Productivity',
    nodeCategory: 'action',
  },
];

export const FLOW_CONTROL_ITEMS: FlowPaletteItem[] = [
  {
    id: 'flow-condition',
    actionType: 'conditional_branch',
    name: 'Condition',
    description: 'If/else branching logic',
    icon: '🔀',
    paletteCategory: 'Flow Control',
    nodeCategory: 'condition',
  },
  {
    id: 'flow-delay',
    actionType: 'delay',
    name: 'Delay',
    description: 'Wait before continuing',
    icon: '⏳',
    paletteCategory: 'Flow Control',
    nodeCategory: 'delay',
  },
  {
    id: 'flow-loop',
    actionType: 'loop',
    name: 'Loop',
    description: 'Repeat actions for each item',
    icon: '🔁',
    paletteCategory: 'Flow Control',
    nodeCategory: 'action',
  },
];

export const ALL_PALETTE_ITEMS: FlowPaletteItem[] = [
  ...TRIGGER_ITEMS,
  ...ACTION_ITEMS,
  ...FLOW_CONTROL_ITEMS,
];
