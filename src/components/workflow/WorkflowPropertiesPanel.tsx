'use client';

/**
 * WorkflowPropertiesPanel Component
 * Configure selected workflow step properties
 *
 * Features:
 * - Dynamic form based on step type
 * - Save changes to workflow state
 * - Validation and error handling
 */

import { useState, useEffect, memo, useCallback } from 'react';
import type { WorkflowStep } from './WorkflowStepCard';

interface WorkflowPropertiesPanelProps {
  step: WorkflowStep | null;
  onUpdate: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onClose: () => void;
}

// Field configuration for each step type
interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'url' | 'duration' | 'cron' | 'json';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  helpText?: string;
}

// Get fields based on action type
function getFieldsForActionType(actionType: string): FieldConfig[] {
  switch (actionType) {
    // Triggers
    case 'form_submitted':
      return [
        { key: 'formId', label: 'Form ID', type: 'text', placeholder: 'Leave empty for any form', helpText: 'Specific form ID or empty for all forms' },
        { key: 'schemaId', label: 'Target Schema', type: 'text', placeholder: 'e.g., leads, contacts', required: true },
      ];
    case 'deal_stage_changed':
      return [
        { key: 'fromStage', label: 'From Stage', type: 'select', options: [
          { value: '', label: 'Any Stage' },
          { value: 'lead', label: 'Lead' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'proposal', label: 'Proposal' },
          { value: 'negotiation', label: 'Negotiation' },
          { value: 'closed_won', label: 'Closed Won' },
          { value: 'closed_lost', label: 'Closed Lost' },
        ]},
        { key: 'toStage', label: 'To Stage', type: 'select', options: [
          { value: '', label: 'Any Stage' },
          { value: 'lead', label: 'Lead' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'proposal', label: 'Proposal' },
          { value: 'negotiation', label: 'Negotiation' },
          { value: 'closed_won', label: 'Closed Won' },
          { value: 'closed_lost', label: 'Closed Lost' },
        ]},
      ];
    case 'scheduled':
      return [
        { key: 'scheduleType', label: 'Schedule Type', type: 'select', required: true, options: [
          { value: 'interval', label: 'Interval' },
          { value: 'cron', label: 'Cron Expression' },
        ]},
        { key: 'cron', label: 'Cron Expression', type: 'cron', placeholder: '0 9 * * 1-5', helpText: 'e.g., 0 9 * * 1-5 for weekdays at 9am' },
        { key: 'intervalValue', label: 'Interval Value', type: 'number', placeholder: '1' },
        { key: 'intervalUnit', label: 'Interval Unit', type: 'select', options: [
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' },
          { value: 'weeks', label: 'Weeks' },
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
        { key: 'requireAuth', label: 'Require Authentication', type: 'select', options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]},
        { key: 'secret', label: 'Webhook Secret', type: 'text', placeholder: 'Optional secret for verification' },
      ];
    case 'entity_created':
    case 'entity_updated':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Leads' },
          { value: 'contacts', label: 'Contacts' },
          { value: 'deals', label: 'Deals' },
          { value: 'companies', label: 'Companies' },
          { value: 'tasks', label: 'Tasks' },
        ]},
        { key: 'specificFields', label: 'Specific Fields', type: 'text', placeholder: 'email, status (comma-separated)', helpText: 'Only trigger when these fields change' },
      ];
    case 'manual':
      return [
        { key: 'requireConfirmation', label: 'Require Confirmation', type: 'select', options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]},
        { key: 'confirmationMessage', label: 'Confirmation Message', type: 'textarea', placeholder: 'Are you sure you want to run this workflow?' },
      ];

    // Actions
    case 'send_email':
      return [
        { key: 'to', label: 'To', type: 'email', placeholder: 'recipient@example.com or {{contact.email}}', required: true },
        { key: 'cc', label: 'CC', type: 'email', placeholder: 'cc@example.com' },
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
    case 'update_field':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Leads' },
          { value: 'contacts', label: 'Contacts' },
          { value: 'deals', label: 'Deals' },
          { value: 'companies', label: 'Companies' },
        ]},
        { key: 'field', label: 'Field Name', type: 'text', placeholder: 'status', required: true },
        { key: 'value', label: 'New Value', type: 'text', placeholder: 'Value or {{variable}}', required: true },
        { key: 'operation', label: 'Operation', type: 'select', options: [
          { value: 'set', label: 'Set Value' },
          { value: 'increment', label: 'Increment' },
          { value: 'append', label: 'Append' },
        ]},
      ];
    case 'create_task':
      return [
        { key: 'title', label: 'Task Title', type: 'text', placeholder: 'Follow up with {{contact.name}}', required: true },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Task details' },
        { key: 'assignTo', label: 'Assign To', type: 'text', placeholder: 'user@example.com or {{deal.owner}}', required: true },
        { key: 'dueDate', label: 'Due Date', type: 'text', placeholder: '+3 days or specific date' },
        { key: 'priority', label: 'Priority', type: 'select', options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ]},
      ];
    case 'ai_generate':
      return [
        { key: 'prompt', label: 'AI Prompt', type: 'textarea', placeholder: 'Write a follow-up email for {{deal.name}}...', required: true },
        { key: 'model', label: 'AI Model', type: 'select', options: [
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'claude-3', label: 'Claude 3' },
        ]},
        { key: 'saveAs', label: 'Save Result As', type: 'text', placeholder: 'ai_response', helpText: 'Variable name to store the result' },
        { key: 'maxTokens', label: 'Max Tokens', type: 'number', placeholder: '1000' },
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
        { key: 'untilDate', label: 'Until Date', type: 'text', placeholder: '{{deal.followUpDate}} or specific date' },
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
    case 'create_entity':
      return [
        { key: 'schemaId', label: 'Entity Type', type: 'select', required: true, options: [
          { value: 'leads', label: 'Lead' },
          { value: 'contacts', label: 'Contact' },
          { value: 'deals', label: 'Deal' },
          { value: 'companies', label: 'Company' },
          { value: 'tasks', label: 'Task' },
        ]},
        { key: 'fieldMappings', label: 'Field Mappings (JSON)', type: 'json', placeholder: '{"name": "{{trigger.name}}", "email": "{{trigger.email}}"}', required: true },
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
        { key: 'entityId', label: 'Entity ID', type: 'text', placeholder: 'Record ID (for specific)' },
        { key: 'fieldMappings', label: 'Field Updates (JSON)', type: 'json', placeholder: '{"status": "qualified"}', required: true },
      ];
    case 'conditional_branch':
      return [
        { key: 'conditionField', label: 'Field to Check', type: 'text', placeholder: '{{deal.value}}', required: true },
        { key: 'conditionOperator', label: 'Operator', type: 'select', required: true, options: [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'greater_than', label: 'Greater Than' },
          { value: 'less_than', label: 'Less Than' },
          { value: 'contains', label: 'Contains' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' },
        ]},
        { key: 'conditionValue', label: 'Value', type: 'text', placeholder: 'Value to compare' },
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

function WorkflowPropertiesPanel({ step, onUpdate, onClose }: WorkflowPropertiesPanelProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [localName, setLocalName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state with step prop
  useEffect(() => {
    if (step) {
      setLocalConfig(step.config || {});
      setLocalName(step.name || '');
      setHasChanges(false);
    }
  }, [step]);

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setLocalName(value);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (step) {
      onUpdate(step.id, {
        name: localName,
        config: localConfig,
      });
      setHasChanges(false);
    }
  }, [step, localName, localConfig, onUpdate]);

  if (!step) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0a]">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-gray-200">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              Select a step to view and edit its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fields = getFieldsForActionType(step.actionType);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Properties</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Step Type Badge */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
            ${step.type === 'trigger' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}
          `}>
            <span>{step.type === 'trigger' ? 'Trigger' : 'Action'}</span>
            <span className="opacity-60">|</span>
            <span>{step.actionType.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Step Name */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Step Name
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            placeholder="Enter step name"
          />
        </div>

        {/* Dynamic Fields */}
        {fields.length > 0 ? (
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'cron' ? (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder={field.placeholder}
                  />
                ) : field.type === 'textarea' || field.type === 'json' ? (
                  <textarea
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none font-mono"
                    placeholder={field.placeholder}
                    rows={field.type === 'json' ? 4 : 3}
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    value={(localConfig[field.key] as number) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder={field.placeholder}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={(localConfig[field.key] as string) || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                {field.helpText && (
                  <p className="mt-1.5 text-xs text-gray-500">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No configuration needed</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all
            ${hasChanges
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
              : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </div>
  );
}

export default memo(WorkflowPropertiesPanel);
