'use client';

/**
 * WorkflowPalette Component
 * Available triggers and actions palette for the workflow builder
 *
 * Features:
 * - Triggers: form_submitted, deal_stage_changed, scheduled, webhook
 * - Actions: send_email, send_sms, update_field, create_task, ai_generate
 * - Click to add to workflow
 * - Categorized display with search
 */

import { useState, memo } from 'react';

export interface PaletteItem {
  id: string;
  type: 'trigger' | 'action';
  actionType: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface WorkflowPaletteProps {
  onAddStep: (item: PaletteItem) => void;
  hasTrigger: boolean;
}

// Available triggers
const triggers: PaletteItem[] = [
  {
    id: 'trigger-form',
    type: 'trigger',
    actionType: 'form_submitted',
    name: 'Form Submitted',
    description: 'When a form is submitted',
    icon: '📝',
    category: 'Events',
  },
  {
    id: 'trigger-deal-stage',
    type: 'trigger',
    actionType: 'deal_stage_changed',
    name: 'Deal Stage Changed',
    description: 'When a deal moves to a new stage',
    icon: '📊',
    category: 'Events',
  },
  {
    id: 'trigger-scheduled',
    type: 'trigger',
    actionType: 'scheduled',
    name: 'Scheduled',
    description: 'Run on a schedule (cron)',
    icon: '⏰',
    category: 'Time',
  },
  {
    id: 'trigger-webhook',
    type: 'trigger',
    actionType: 'webhook',
    name: 'Webhook',
    description: 'Triggered by external webhook',
    icon: '🔗',
    category: 'External',
  },
  {
    id: 'trigger-entity-created',
    type: 'trigger',
    actionType: 'entity_created',
    name: 'Record Created',
    description: 'When a new record is created',
    icon: '✨',
    category: 'Events',
  },
  {
    id: 'trigger-entity-updated',
    type: 'trigger',
    actionType: 'entity_updated',
    name: 'Record Updated',
    description: 'When a record is updated',
    icon: '🔄',
    category: 'Events',
  },
  {
    id: 'trigger-manual',
    type: 'trigger',
    actionType: 'manual',
    name: 'Manual',
    description: 'Triggered manually by user',
    icon: '👆',
    category: 'Manual',
  },
];

// Available actions
const actions: PaletteItem[] = [
  {
    id: 'action-email',
    type: 'action',
    actionType: 'send_email',
    name: 'Send Email',
    description: 'Send an email to contacts',
    icon: '📧',
    category: 'Communication',
  },
  {
    id: 'action-sms',
    type: 'action',
    actionType: 'send_sms',
    name: 'Send SMS',
    description: 'Send a text message',
    icon: '💬',
    category: 'Communication',
  },
  {
    id: 'action-slack',
    type: 'action',
    actionType: 'send_slack',
    name: 'Send Slack Message',
    description: 'Post to Slack channel',
    icon: '💼',
    category: 'Communication',
  },
  {
    id: 'action-update-field',
    type: 'action',
    actionType: 'update_field',
    name: 'Update Field',
    description: 'Update a record field',
    icon: '✏️',
    category: 'Data',
  },
  {
    id: 'action-create-task',
    type: 'action',
    actionType: 'create_task',
    name: 'Create Task',
    description: 'Create a task for a team member',
    icon: '✅',
    category: 'Productivity',
  },
  {
    id: 'action-ai-generate',
    type: 'action',
    actionType: 'ai_generate',
    name: 'AI Generate',
    description: 'Generate content with AI',
    icon: '🤖',
    category: 'AI',
  },
  {
    id: 'action-delay',
    type: 'action',
    actionType: 'delay',
    name: 'Delay',
    description: 'Wait before next action',
    icon: '⏳',
    category: 'Flow Control',
  },
  {
    id: 'action-http',
    type: 'action',
    actionType: 'http_request',
    name: 'HTTP Request',
    description: 'Make an API request',
    icon: '🌐',
    category: 'External',
  },
  {
    id: 'action-create-entity',
    type: 'action',
    actionType: 'create_entity',
    name: 'Create Record',
    description: 'Create a new record',
    icon: '➕',
    category: 'Data',
  },
  {
    id: 'action-update-entity',
    type: 'action',
    actionType: 'update_entity',
    name: 'Update Record',
    description: 'Update an existing record',
    icon: '📝',
    category: 'Data',
  },
  {
    id: 'action-conditional',
    type: 'action',
    actionType: 'conditional_branch',
    name: 'Conditional Branch',
    description: 'Add conditional logic',
    icon: '🔀',
    category: 'Flow Control',
  },
  {
    id: 'action-loop',
    type: 'action',
    actionType: 'loop',
    name: 'Loop',
    description: 'Repeat actions for each item',
    icon: '🔁',
    category: 'Flow Control',
  },
];

// Get unique categories
function getCategories(items: PaletteItem[]): string[] {
  const categories = new Set(items.map(item => item.category));
  return Array.from(categories);
}

function WorkflowPalette({ onAddStep, hasTrigger }: WorkflowPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'triggers' | 'actions'>(hasTrigger ? 'actions' : 'triggers');

  // Filter items based on search
  const filterItems = (items: PaletteItem[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  };

  const filteredTriggers = filterItems(triggers);
  const filteredActions = filterItems(actions);

  const renderItemsByCategory = (items: PaletteItem[]) => {
    const categories = getCategories(items);
    const groupedItems = categories.map(category => ({
      category,
      items: items.filter(item => item.category === category),
    }));

    return groupedItems.map(group => (
      <div key={group.category} className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          {group.category}
        </h4>
        <div className="space-y-1">
          {group.items.map(item => (
            <button
              key={item.id}
              onClick={() => onAddStep(item)}
              disabled={item.type === 'trigger' && hasTrigger}
              className={`
                w-full p-3 rounded-xl text-left transition-all duration-200
                border border-transparent
                ${item.type === 'trigger' && hasTrigger
                  ? 'opacity-50 cursor-not-allowed bg-white/5'
                  : 'bg-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.98]'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center text-xl
                  ${item.type === 'trigger' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'}
                `}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.description}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Add Step</h3>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search steps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('triggers')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative
            ${activeTab === 'triggers'
              ? 'text-emerald-400'
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
        >
          Triggers
          {activeTab === 'triggers' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative
            ${activeTab === 'actions'
              ? 'text-indigo-400'
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
        >
          Actions
          {activeTab === 'actions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'triggers' ? (
          <>
            {hasTrigger && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-400">
                  A workflow can only have one trigger. Delete the existing trigger to add a new one.
                </p>
              </div>
            )}
            {filteredTriggers.length > 0 ? (
              renderItemsByCategory(filteredTriggers)
            ) : (
              <p className="text-center text-gray-500 text-sm py-8">No triggers found</p>
            )}
          </>
        ) : (
          <>
            {!hasTrigger && (
              <div className="mb-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs text-indigo-400">
                  Add a trigger first to start your workflow.
                </p>
              </div>
            )}
            {filteredActions.length > 0 ? (
              renderItemsByCategory(filteredActions)
            ) : (
              <p className="text-center text-gray-500 text-sm py-8">No actions found</p>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-gray-500 text-center">
          Click on a step to add it to your workflow
        </p>
      </div>
    </div>
  );
}

export default memo(WorkflowPalette);
