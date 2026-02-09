'use client';

/**
 * WorkflowStepCard Component
 * Individual step card for the visual workflow builder
 *
 * Features:
 * - Shows step type icon, name, and brief config
 * - Click to select, shows delete button
 * - Visual connection line to next step
 * - Drag handle for reordering
 */

import { memo } from 'react';

// Step type definitions
export type StepType = 'trigger' | 'action' | 'condition';

export interface WorkflowStep {
  id: string;
  type: StepType;
  actionType: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  order: number;
}

interface WorkflowStepCardProps {
  step: WorkflowStep;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

// Icon mapping for different step types
const stepIcons: Record<string, { icon: string; color: string }> = {
  // Triggers
  form_submitted: { icon: '📝', color: 'emerald' },
  deal_stage_changed: { icon: '📊', color: 'emerald' },
  scheduled: { icon: '⏰', color: 'emerald' },
  webhook: { icon: '🔗', color: 'emerald' },
  entity_created: { icon: '✨', color: 'emerald' },
  entity_updated: { icon: '🔄', color: 'emerald' },
  manual: { icon: '👆', color: 'emerald' },
  // Actions
  send_email: { icon: '📧', color: 'indigo' },
  send_sms: { icon: '💬', color: 'indigo' },
  update_field: { icon: '✏️', color: 'indigo' },
  create_task: { icon: '✅', color: 'indigo' },
  ai_generate: { icon: '🤖', color: 'violet' },
  delay: { icon: '⏳', color: 'amber' },
  http_request: { icon: '🌐', color: 'indigo' },
  send_slack: { icon: '💼', color: 'indigo' },
  create_entity: { icon: '➕', color: 'indigo' },
  update_entity: { icon: '📝', color: 'indigo' },
  delete_entity: { icon: '🗑️', color: 'red' },
  conditional_branch: { icon: '🔀', color: 'amber' },
  loop: { icon: '🔁', color: 'amber' },
};

// Get color classes based on step type
function getTypeColors(type: StepType, actionType: string) {
  const iconData = stepIcons[actionType];
  const color = iconData?.color || (type === 'trigger' ? 'emerald' : type === 'condition' ? 'amber' : 'indigo');

  const colors: Record<string, { border: string; bg: string; badge: string; badgeText: string; iconBg: string }> = {
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      badge: 'bg-emerald-500/20',
      badgeText: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
    },
    indigo: {
      border: 'border-indigo-500/30',
      bg: 'bg-indigo-500/5',
      badge: 'bg-indigo-500/20',
      badgeText: 'text-indigo-400',
      iconBg: 'bg-indigo-500/20',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/5',
      badge: 'bg-amber-500/20',
      badgeText: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
    },
    violet: {
      border: 'border-violet-500/30',
      bg: 'bg-violet-500/5',
      badge: 'bg-violet-500/20',
      badgeText: 'text-violet-400',
      iconBg: 'bg-violet-500/20',
    },
    red: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      badge: 'bg-red-500/20',
      badgeText: 'text-red-400',
      iconBg: 'bg-red-500/20',
    },
  };

  return colors[color] || colors.indigo;
}

function getStepIcon(actionType: string): string {
  return stepIcons[actionType]?.icon || '⚡';
}

function getStepTypeLabel(type: StepType): string {
  switch (type) {
    case 'trigger':
      return 'Trigger';
    case 'condition':
      return 'Condition';
    case 'action':
      return 'Action';
    default:
      return 'Step';
  }
}

function getConfigSummary(step: WorkflowStep): string {
  const { actionType, config } = step;

  switch (actionType) {
    case 'send_email':
      return config.to ? `To: ${Array.isArray(config.to) ? config.to[0] : config.to}` : 'Configure recipient';
    case 'send_sms':
      return config.to ? `To: ${config.to}` : 'Configure recipient';
    case 'update_field':
      return config.field ? `Update: ${config.field}` : 'Configure field';
    case 'create_task':
      return config.title ? `Task: ${config.title}` : 'Configure task';
    case 'ai_generate':
      return config.prompt ? 'AI prompt configured' : 'Configure AI action';
    case 'delay':
      if (config.duration) {
        const d = config.duration as { value: number; unit: string };
        return `Wait ${d.value} ${d.unit}`;
      }
      return 'Configure delay';
    case 'scheduled':
      return config.cron ? 'Schedule configured' : 'Configure schedule';
    case 'webhook':
      return 'Webhook endpoint ready';
    case 'form_submitted':
      return config.formId ? `Form: ${config.formId}` : 'Any form submission';
    case 'deal_stage_changed':
      return config.stage ? `Stage: ${config.stage}` : 'Any stage change';
    case 'http_request':
      return config.url ? `${config.method ?? 'GET'} request` : 'Configure request';
    default:
      return step.description ?? 'Click to configure';
  }
}

function WorkflowStepCard({
  step,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: WorkflowStepCardProps) {
  const colors = getTypeColors(step.type, step.actionType);
  const icon = getStepIcon(step.actionType);
  const typeLabel = getStepTypeLabel(step.type);
  const configSummary = getConfigSummary(step);

  const isTrigger = step.type === 'trigger';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Connection line from previous step */}
      {!isFirst && (
        <div className="w-0.5 h-8 bg-gradient-to-b from-border-light to-border-strong" />
      )}

      {/* Step Card */}
      <div
        draggable={!isTrigger}
        onDragStart={!isTrigger ? onDragStart : undefined}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onSelect}
        className={`
          w-full max-w-md p-4 rounded-xl border backdrop-blur-sm cursor-pointer
          transition-all duration-200 group
          ${colors.border} ${colors.bg}
          ${isSelected
            ? 'ring-2 ring-primary shadow-lg shadow-primary/20'
            : 'hover:shadow-lg hover:shadow-primary/5 hover:border-border-strong'
          }
          ${!isTrigger ? 'active:scale-[0.98]' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle (for non-triggers) */}
          {!isTrigger && (
            <div className="flex items-center justify-center w-4 h-12 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
              <svg className="w-4 h-4 text-[var(--color-text-disabled)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-8 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
              </svg>
            </div>
          )}

          {/* Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0
            ${colors.iconBg}
          `}>
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge} ${colors.badgeText}`}>
                {typeLabel}
              </span>
              <span className="text-xs text-[var(--color-text-disabled)]">#{step.order + 1}</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {step.name}
            </h3>
            <p className="text-xs text-[var(--color-text-disabled)] mt-0.5 truncate">
              {configSummary}
            </p>
          </div>

          {/* Delete Button (for non-triggers) */}
          {!isTrigger && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg text-[var(--color-text-disabled)] opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all"
              title="Delete step"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Connection line to next step */}
      {!isLast && (
        <div className="w-0.5 h-4 bg-border-light" />
      )}
    </div>
  );
}

export default memo(WorkflowStepCard);
