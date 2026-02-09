'use client';

/* eslint-disable no-alert -- Admin UI uses native dialogs */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import type { Workflow } from '@/types/workflow';

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  status: string;
  trigger?: { type?: string };
  stats?: { totalRuns?: number };
}

interface WorkflowsResponse {
  workflows?: WorkflowItem[];
}

interface WorkflowWithId extends Partial<Workflow> {
  id: string;
}

export default function WorkflowsPage() {
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);
  const [workflowsList, setWorkflowsList] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // Load workflows from API
  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const token = await currentUser.getIdToken();

      const response = await fetch('/api/workflows', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }

      const data = await response.json() as WorkflowsResponse;
      setWorkflowsList(data.workflows ?? []);
    } catch (error: unknown) {
      console.error('Error loading workflows:', error);
      setError(error instanceof Error ? error.message : 'Failed to load workflows');
      setWorkflowsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  async function toggleWorkflowStatus(workflowId: string, currentStatus: string) {
    try {
      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {return;}

      const token = await currentUser.getIdToken();
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.ok) {
        void loadWorkflows(); // Reload to get fresh data
      } else {
        throw new Error('Failed to update workflow status');
      }
    } catch (error: unknown) {
      console.error('Error toggling workflow status:', error);
      alert(`Failed to update workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <>
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <Link href={`/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Workflows</h1>
                <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>Automation rules and workflow configuration</p>
              </div>
              <button 
                onClick={() => {
                  setEditingWorkflow(null);
                  setShowBuilder(true);
                }}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                + Create Workflow
              </button>
            </div>

            {/* Explanation Box */}
            <div style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.15)', border: '1px solid var(--color-primary-dark)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> What are Workflows?
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                Workflows automate repetitive tasks in your CRM. When a trigger event occurs (like a new contact being created or a deal stage changing), 
                the workflow automatically performs actions like sending emails, updating records, or notifying your team.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>Common Triggers</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Contact created, Deal won, Invoice overdue, Task completed</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-success)', marginBottom: '0.25rem' }}>Common Actions</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Send email, Create task, Update field, Notify team via Slack</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-warning)', marginBottom: '0.25rem' }}>Getting Started</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Click &quot;Create Workflow&quot; to build your first automation</div>
                </div>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                Loading workflows...
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.5rem', padding: '1rem', color: 'var(--color-error-light)', marginBottom: '1rem' }}>
                Error: {error}
              </div>
            )}

            {!loading && !error && workflowsList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                <p style={{ marginBottom: '1rem' }}>No workflows yet. Create your first workflow to get started!</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {!loading && workflowsList.map(workflow => {
                const isActive = workflow.status === 'active';
                const triggerType = workflow.trigger?.type;
                const triggerDisplay = (triggerType !== '' && triggerType != null) ? triggerType : 'N/A';
                const runsToday = workflow.stats?.totalRuns ?? 0;
                
                return (
                  <div key={workflow.id} style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>{workflow.name}</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>{(workflow.description !== '' && workflow.description != null) ? workflow.description : 'No description'}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                          <span style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)' }}>
                            Trigger: {triggerDisplay}
                          </span>
                          <span style={{ padding: '0.25rem 0.75rem', backgroundColor: isActive ? 'var(--color-success-dark)' : 'var(--color-text-disabled)', color: isActive ? 'var(--color-success-light)' : 'var(--color-text-secondary)', borderRadius: '9999px', fontWeight: '600' }}>
                            {isActive ? 'Active' :(workflow.status !== '' && workflow.status != null) ? workflow.status : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--color-border-strong)' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>Total runs: <span style={{ color: primaryColor, fontWeight: '600' }}>{runsToday}</span></div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => {
                            setEditingWorkflow(workflow as unknown as Partial<Workflow>);
                            setShowBuilder(true);
                          }}
                          style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void toggleWorkflowStatus(workflow.id, workflow.status)}
                          style={{ padding: '0.5rem 1rem', backgroundColor: isActive ? 'var(--color-warning-dark)' : primaryColor, color: isActive ? 'var(--color-warning-light)' : 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          {isActive ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {showBuilder && (
        <WorkflowBuilder
          workflow={editingWorkflow}
          onSave={(workflow) => void (async () => {
            try {
              const { getCurrentUser } = await import('@/lib/auth/auth-service');
              const currentUser = getCurrentUser();
              
              if (!currentUser) {
                throw new Error('Not authenticated');
              }

              const token = await currentUser.getIdToken();
              const workflowWithId = editingWorkflow as WorkflowWithId | null;
              const isEditing = workflowWithId?.id;
              const endpoint = isEditing
                ? `/api/workflows/${workflowWithId.id}`
                : '/api/workflows';
              
              const method = isEditing ? 'PUT' : 'POST';
              
              const response = await fetch(endpoint, {
                method,
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  workflow,
                }),
              });
              
              if (!response.ok) {
                throw new Error('Failed to save workflow');
              }
              
              // Reload workflows to get fresh data
              await loadWorkflows();
              setShowBuilder(false);
              setEditingWorkflow(null);
            } catch (error: unknown) {
              console.error('Error saving workflow:', error);
              alert(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          })()}
          onCancel={() => {
            setShowBuilder(false);
            setEditingWorkflow(null);
          }}
        />
      )}
    </>
  );
}


