'use client';

/**
 * FlowPropertiesPanel
 * Right sidebar for the ReactFlow workflow builder.
 * Shows configuration form for the currently selected node.
 */

import { useState, useEffect, memo, useCallback } from 'react';
import type { Node } from 'reactflow';
import type { FlowNodeData } from './nodes/types';

interface FlowPropertiesPanelProps {
  selectedNode: Node<FlowNodeData> | null;
  onNodeUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onNodeDelete: (nodeId: string) => void;
  onClose: () => void;
}

// ============================================================================
// Field configuration per action type
// ============================================================================

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'url' | 'json';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  helpText?: string;
}

function getFieldsForActionType(actionType: string): FieldConfig[] {
  switch (actionType) {
    // Triggers
    case 'entity.created':
    case 'entity.updated':
    case 'entity.deleted':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Leads' },
          { value: 'contacts', label: 'Contacts' },
          { value: 'deals', label: 'Deals' },
          { value: 'companies', label: 'Companies' },
          { value: 'tasks', label: 'Tasks' },
        ]},
        { key: 'specificFields', label: 'Specific Fields (comma-separated)', type: 'text', placeholder: 'email, status', helpText: 'Only trigger when these fields change' },
      ];
    case 'schedule':
      return [
        { key: 'scheduleType', label: 'Schedule Type', type: 'select', required: true, options: [
          { value: 'interval', label: 'Interval' },
          { value: 'cron', label: 'Cron Expression' },
        ]},
        { key: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * 1-5', helpText: 'e.g., 0 9 * * 1-5 for weekdays at 9am' },
        { key: 'intervalValue', label: 'Interval Value', type: 'number', placeholder: '1' },
        { key: 'intervalUnit', label: 'Interval Unit', type: 'select', options: [
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' },
          { value: 'weeks', label: 'Weeks' },
          { value: 'months', label: 'Months' },
        ]},
        { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/New_York' },
      ];
    case 'webhook':
      return [
        { key: 'method', label: 'HTTP Method', type: 'select', required: true, options: [
          { value: 'POST', label: 'POST' },
          { value: 'GET', label: 'GET' },
          { value: 'PUT', label: 'PUT' },
        ]},
        { key: 'requireAuth', label: 'Require Auth', type: 'select', options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]},
        { key: 'secret', label: 'Webhook Secret', type: 'text', placeholder: 'Optional verification secret' },
      ];
    case 'manual':
      return [
        { key: 'requireConfirmation', label: 'Require Confirmation', type: 'select', options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]},
        { key: 'confirmationMessage', label: 'Confirmation Message', type: 'textarea', placeholder: 'Are you sure you want to run this workflow?' },
      ];
    case 'ai_agent':
      return [
        { key: 'agentId', label: 'Agent ID', type: 'text', placeholder: 'Agent identifier', required: true },
        { key: 'triggerOn', label: 'Trigger On', type: 'select', required: true, options: [
          { value: 'conversation_end', label: 'Conversation End' },
          { value: 'keyword_detected', label: 'Keyword Detected' },
          { value: 'intent_classified', label: 'Intent Classified' },
          { value: 'custom', label: 'Custom' },
        ]},
        { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text', placeholder: 'buy, purchase, interested' },
      ];
    case 'form.submitted':
      return [
        { key: 'formId', label: 'Form ID', type: 'text', placeholder: 'Leave empty for any form' },
        { key: 'schemaId', label: 'Target Schema', type: 'text', placeholder: 'e.g., leads', required: true },
      ];
    case 'email.received':
      return [
        { key: 'emailAddress', label: 'Listening Email', type: 'email', placeholder: 'workflow@example.com', required: true },
        { key: 'fromAddresses', label: 'From Filter (comma-separated)', type: 'text', placeholder: 'sender@example.com' },
        { key: 'subjectContains', label: 'Subject Contains', type: 'text', placeholder: 'Quote, Invoice' },
      ];

    // Actions
    case 'send_email':
      return [
        { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com or {{contact.email}}', required: true },
        { key: 'cc', label: 'CC', type: 'text', placeholder: 'cc@example.com' },
        { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject', required: true },
        { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email content (supports {{variables}})', required: true },
        { key: 'bodyType', label: 'Body Type', type: 'select', options: [
          { value: 'html', label: 'HTML' },
          { value: 'text', label: 'Plain Text' },
        ]},
      ];
    case 'send_sms':
      return [
        { key: 'to', label: 'Phone Number', type: 'text', placeholder: '+1234567890 or {{contact.phone}}', required: true },
        { key: 'message', label: 'Message', type: 'textarea', placeholder: 'SMS content (max 160 chars)', required: true },
      ];
    case 'send_slack':
      return [
        { key: 'channel', label: 'Channel', type: 'text', placeholder: '#general or channel ID', required: true },
        { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Slack message', required: true },
        { key: 'mentions', label: 'Mentions', type: 'text', placeholder: '@user1, @user2' },
      ];
    case 'create_entity':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Lead' },
          { value: 'contacts', label: 'Contact' },
          { value: 'deals', label: 'Deal' },
          { value: 'companies', label: 'Company' },
          { value: 'tasks', label: 'Task' },
        ]},
        { key: 'fieldMappings', label: 'Field Mappings (JSON)', type: 'json', placeholder: '{"name": "{{trigger.name}}"}', required: true },
      ];
    case 'update_entity':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Lead' },
          { value: 'contacts', label: 'Contact' },
          { value: 'deals', label: 'Deal' },
          { value: 'companies', label: 'Company' },
        ]},
        { key: 'targetRecord', label: 'Target Record', type: 'select', options: [
          { value: 'trigger', label: 'Trigger Record' },
          { value: 'specific', label: 'Specific ID' },
          { value: 'query', label: 'Query' },
        ]},
        { key: 'entityId', label: 'Entity ID (if specific)', type: 'text', placeholder: 'Record ID' },
        { key: 'fieldMappings', label: 'Field Updates (JSON)', type: 'json', placeholder: '{"status": "qualified"}', required: true },
      ];
    case 'delete_entity':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Lead' },
          { value: 'contacts', label: 'Contact' },
          { value: 'deals', label: 'Deal' },
          { value: 'companies', label: 'Company' },
        ]},
        { key: 'targetRecord', label: 'Target', type: 'select', options: [
          { value: 'trigger', label: 'Trigger Record' },
          { value: 'specific', label: 'Specific ID' },
        ]},
        { key: 'softDelete', label: 'Soft Delete', type: 'select', options: [
          { value: 'true', label: 'Yes (archive)' },
          { value: 'false', label: 'No (permanent)' },
        ]},
      ];
    case 'http_request':
      return [
        { key: 'method', label: 'Method', type: 'select', required: true, options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ]},
        { key: 'url', label: 'URL', type: 'url', placeholder: 'https://api.example.com/webhook', required: true },
        { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Authorization": "Bearer token"}' },
        { key: 'body', label: 'Body (JSON)', type: 'json', placeholder: '{"key": "value"}' },
        { key: 'saveResponseAs', label: 'Save Response As', type: 'text', placeholder: 'api_response' },
      ];
    case 'cloud_function':
      return [
        { key: 'functionName', label: 'Function Name', type: 'text', placeholder: 'processLead', required: true },
        { key: 'parameters', label: 'Parameters (JSON)', type: 'json', placeholder: '{"param1": "value"}' },
        { key: 'saveResponseAs', label: 'Save Response As', type: 'text', placeholder: 'fn_response' },
      ];
    case 'create_task':
      return [
        { key: 'title', label: 'Task Title', type: 'text', placeholder: 'Follow up with {{contact.name}}', required: true },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Task details' },
        { key: 'assignTo', label: 'Assign To', type: 'text', placeholder: 'user@example.com', required: true },
        { key: 'dueDate', label: 'Due Date', type: 'text', placeholder: '+3 days or specific date' },
        { key: 'priority', label: 'Priority', type: 'select', options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ]},
      ];

    // Flow control
    case 'conditional_branch':
      return [
        { key: 'conditionField', label: 'Field to Check', type: 'text', placeholder: '{{deal.value}}', required: true },
        { key: 'conditionOperator', label: 'Operator', type: 'select', required: true, options: [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'greater_than', label: 'Greater Than' },
          { value: 'less_than', label: 'Less Than' },
          { value: 'contains', label: 'Contains' },
          { value: 'not_contains', label: 'Not Contains' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' },
          { value: 'is_true', label: 'Is True' },
          { value: 'is_false', label: 'Is False' },
        ]},
        { key: 'conditionValue', label: 'Value', type: 'text', placeholder: 'Value to compare' },
      ];
    case 'delay':
      return [
        { key: 'delayType', label: 'Delay Type', type: 'select', required: true, options: [
          { value: 'duration', label: 'Wait for duration' },
          { value: 'until', label: 'Wait until date/time' },
        ]},
        { key: 'durationValue', label: 'Duration', type: 'number', placeholder: '30' },
        { key: 'durationUnit', label: 'Unit', type: 'select', options: [
          { value: 'seconds', label: 'Seconds' },
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' },
        ]},
        { key: 'untilDate', label: 'Until Date', type: 'text', placeholder: '{{deal.followUpDate}} or ISO date' },
      ];
    case 'loop':
      return [
        { key: 'iterateOver', label: 'Iterate Over', type: 'select', required: true, options: [
          { value: 'array_field', label: 'Array Field' },
          { value: 'query_results', label: 'Query Results' },
          { value: 'range', label: 'Number Range' },
        ]},
        { key: 'arrayField', label: 'Array Field', type: 'text', placeholder: '{{contacts}}' },
        { key: 'maxIterations', label: 'Max Iterations', type: 'number', placeholder: '100' },
      ];
    default:
      return [];
  }
}

/** Build a human-readable config summary from node config */
function buildConfigSummary(actionType: string, config: Record<string, unknown>): string {
  switch (actionType) {
    case 'send_email':
      return config.to ? `To: ${config.to}` : 'Configure recipient';
    case 'send_sms':
      return config.to ? `To: ${config.to}` : 'Configure recipient';
    case 'send_slack':
      return config.channel ? `#${config.channel}` : 'Configure channel';
    case 'http_request':
      return config.url ? `${config.method ?? 'GET'} ${config.url}` : 'Configure request';
    case 'delay':
      if (config.durationValue && config.durationUnit) {
        return `Wait ${config.durationValue} ${config.durationUnit}`;
      }
      return 'Configure delay';
    case 'conditional_branch':
      if (config.conditionField) {
        return `If ${config.conditionField} ${config.conditionOperator ?? 'equals'} ${config.conditionValue ?? '...'}`;
      }
      return 'Configure condition';
    case 'entity.created':
    case 'entity.updated':
    case 'entity.deleted':
      return config.schemaId ? `Schema: ${config.schemaId}` : 'Configure entity';
    case 'schedule':
      return config.cron ? `Cron: ${config.cron}` : 'Configure schedule';
    case 'create_entity':
    case 'update_entity':
    case 'delete_entity':
      return config.schemaId ? `Target: ${config.schemaId}` : 'Configure target';
    case 'create_task':
      return config.title ? `Task: ${config.title}` : 'Configure task';
    default:
      return 'Click to configure';
  }
}

// ============================================================================
// Component
// ============================================================================

function FlowPropertiesPanel({ selectedNode, onNodeUpdate, onNodeDelete, onClose }: FlowPropertiesPanelProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [localLabel, setLocalLabel] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when the selected node changes
  useEffect(() => {
    if (selectedNode) {
      setLocalConfig(selectedNode.data.config || {});
      setLocalLabel(selectedNode.data.label || '');
      setLocalDescription(selectedNode.data.description || '');
      setHasChanges(false);
    }
  }, [selectedNode]);

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNode) {
      return;
    }
    const actionType = selectedNode.data.actionType;
    const newDescription = buildConfigSummary(actionType, localConfig);
    onNodeUpdate(selectedNode.id, {
      label: localLabel,
      config: localConfig,
      description: localDescription || newDescription,
    });
    setHasChanges(false);
  }, [selectedNode, localLabel, localConfig, localDescription, onNodeUpdate]);

  // ---- Empty state ----
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-main)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-bg-elevated)' }}
            >
              <svg className="w-8 h-8" style={{ color: 'var(--color-text-disabled)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
              Select a node to view its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const nodeData = selectedNode.data;
  const fields = getFieldsForActionType(nodeData.actionType);

  const categoryColors: Record<string, { badge: string; text: string }> = {
    trigger: { badge: 'bg-emerald-500/20', text: 'text-emerald-400' },
    action: { badge: 'bg-indigo-500/20', text: 'text-indigo-400' },
    condition: { badge: 'bg-amber-500/20', text: 'text-amber-400' },
    delay: { badge: 'bg-slate-500/20', text: 'text-slate-400' },
  };
  const colors = categoryColors[nodeData.category] || categoryColors.action;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-light)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Properties</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Type badge */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${colors.badge} ${colors.text}`}>
            <span className="capitalize">{nodeData.category}</span>
            <span className="opacity-40">|</span>
            <span>{nodeData.actionType.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Node Label */}
        <div className="mb-4">
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Node Label
          </label>
          <input
            type="text"
            value={localLabel}
            onChange={(e) => { setLocalLabel(e.target.value); setHasChanges(true); }}
            className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
            placeholder="Enter node name"
          />
        </div>

        {/* Step Description */}
        <div className="mb-6">
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Step Description
          </label>
          <textarea
            value={localDescription}
            onChange={(e) => { setLocalDescription(e.target.value); setHasChanges(true); }}
            className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
            placeholder="Describe what this step does (for AI agents)"
            rows={2}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-disabled)' }}>
            Natural language description for AI agent understanding
          </p>
        </div>

        {/* Dynamic Fields */}
        {fields.length > 0 ? (
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-disabled)' }}>
              Configuration
            </h4>
            {fields.map((field) => (
              <div key={field.key}>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {(field.type === 'text' || field.type === 'email' || field.type === 'url') && (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    style={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder={field.placeholder}
                  />
                )}

                {(field.type === 'textarea' || field.type === 'json') && (
                  <textarea
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                    style={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-primary)',
                      fontFamily: field.type === 'json' ? 'monospace' : 'inherit',
                    }}
                    placeholder={field.placeholder}
                    rows={field.type === 'json' ? 4 : 3}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={(localConfig[field.key] as number) ?? ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    style={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder={field.placeholder}
                  />
                )}

                {field.type === 'select' && (
                  <select
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    style={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}

                {field.helpText && (
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-disabled)' }}>
                    {field.helpText}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
              No additional configuration needed
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--color-border-light)' }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
            hasChanges
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
              : 'text-gray-500 cursor-not-allowed'
          }`}
          style={!hasChanges ? { backgroundColor: 'var(--color-bg-elevated)' } : undefined}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </button>

        <button
          onClick={() => onNodeDelete(selectedNode.id)}
          className="w-full py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all border"
          style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}

export default memo(FlowPropertiesPanel);
