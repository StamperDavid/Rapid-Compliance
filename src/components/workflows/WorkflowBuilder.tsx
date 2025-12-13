'use client';

import React, { useState } from 'react';
import { Workflow, WorkflowTrigger, WorkflowAction } from '@/types/workflow';

interface WorkflowBuilderProps {
  workflow: Partial<Workflow> | null;
  onSave: (workflow: Partial<Workflow>) => void;
  onCancel: () => void;
}

export default function WorkflowBuilder({ workflow, onSave, onCancel }: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [triggerType, setTriggerType] = useState<string>('entity.created');
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);
  const [selectedActionType, setSelectedActionType] = useState<string>('');

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';

  const triggerTypes = [
    { value: 'entity.created', label: 'Entity Created', icon: '➕' },
    { value: 'entity.updated', label: 'Entity Updated', icon: '✏️' },
    { value: 'entity.deleted', label: 'Entity Deleted', icon: '🗑️' },
    { value: 'schedule', label: 'Schedule', icon: '⏰' },
    { value: 'webhook', label: 'Webhook', icon: '🔗' },
    { value: 'manual', label: 'Manual', icon: '👆' },
  ];

  const actionTypes = [
    { value: 'send_email', label: 'Send Email', icon: '📧' },
    { value: 'send_sms', label: 'Send SMS', icon: '💬' },
    { value: 'send_slack', label: 'Send Slack', icon: '💬' },
    { value: 'create_entity', label: 'Create Entity', icon: '➕' },
    { value: 'update_entity', label: 'Update Entity', icon: '✏️' },
    { value: 'http_request', label: 'HTTP Request', icon: '🌐' },
    { value: 'delay', label: 'Delay', icon: '⏱️' },
  ];

  const handleAddAction = () => {
    if (!selectedActionType) return;

    const newAction: WorkflowAction = {
      id: `action_${Date.now()}`,
      type: selectedActionType as any,
      name: actionTypes.find(a => a.value === selectedActionType)?.label || 'Action',
    } as WorkflowAction;

    setActions([...actions, newAction]);
    setSelectedActionType('');
  };

  const handleRemoveAction = (actionId: string) => {
    setActions(actions.filter(a => a.id !== actionId));
  };

  const handleSave = () => {
    const workflowData: Partial<Workflow> = {
      ...workflow,
      name,
      description,
      trigger: {
        id: `trigger_${Date.now()}`,
        type: triggerType as any,
        name: triggerTypes.find(t => t.value === triggerType)?.label || 'Trigger',
      } as WorkflowTrigger,
      actions,
      settings: {
        enabled: true,
        stopOnError: false,
      },
    };

    onSave(workflowData);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '1rem',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: textColor, marginBottom: '1rem' }}>
            {workflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: textColor, marginBottom: '0.5rem' }}>
              Workflow Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-assign Hot Leads"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: textColor,
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: textColor, marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: textColor,
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: textColor, marginBottom: '0.75rem' }}>
              Trigger
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {triggerTypes.map((trigger) => (
                <button
                  key={trigger.value}
                  onClick={() => setTriggerType(trigger.value)}
                  style={{
                    padding: '1rem',
                    backgroundColor: triggerType === trigger.value ? primaryColor : 'var(--color-bg-main)',
                    border: `1px solid ${triggerType === trigger.value ? primaryColor : borderColor}`,
                    borderRadius: '0.5rem',
                    color: triggerType === trigger.value ? '#fff' : textColor,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{trigger.icon}</span>
                  <span>{trigger.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: textColor, marginBottom: '0.75rem' }}>
              Actions
            </label>
            
            {actions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {actions.map((action, index) => (
                  <div
                    key={action.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {actionTypes.find(a => a.value === action.type)?.icon || '⚙️'}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: textColor }}>
                          {action.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          {index + 1}. {actionTypes.find(a => a.value === action.type)?.label || action.type}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAction(action.id)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: textColor,
                  fontSize: '0.875rem'
                }}
              >
                <option value="">Select an action...</option>
                {actionTypes.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.icon} {action.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddAction}
                disabled={!selectedActionType}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: selectedActionType ? primaryColor : '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: selectedActionType ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add Action
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: `1px solid ${borderColor}`, paddingTop: '1.5rem' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: textColor,
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || actions.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: (!name || actions.length === 0) ? '#444' : primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: (!name || actions.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
















