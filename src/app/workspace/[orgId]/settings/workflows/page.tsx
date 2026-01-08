'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import type { Workflow } from '@/types/workflow';

export default function WorkflowsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);
  const [workflowsList, setWorkflowsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Load workflows from API
  useEffect(() => {
    loadWorkflows();
  }, [orgId]);

  async function loadWorkflows() {
    try {
      setLoading(true);
      setError(null);
      
      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/workflows?organizationId=${orgId}&workspaceId=default`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }

      const data = await response.json();
      setWorkflowsList(data.workflows ?? []);
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      setError(error.message);
      setWorkflowsList([]);
    } finally {
      setLoading(false);
    }
  }

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
          organizationId: orgId,
          workspaceId: 'default',
          status: newStatus,
        }),
      });

      if (response.ok) {
        loadWorkflows(); // Reload to get fresh data
      } else {
        throw new Error('Failed to update workflow status');
      }
    } catch (error: any) {
      console.error('Error toggling workflow status:', error);
      alert('Failed to update workflow status');
    }
  }

  return (
    <>
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Workflows</h1>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>Automation rules and workflow configuration</p>
              </div>
              <button 
                onClick={() => {
                  setEditingWorkflow(null);
                  setShowBuilder(true);
                }}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                + Create Workflow
              </button>
            </div>

            {/* Explanation Box */}
            <div style={{ backgroundColor: '#1a1a3a', border: '1px solid #3333aa', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> What are Workflows?
              </h3>
              <p style={{ color: '#a0a0c0', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                Workflows automate repetitive tasks in your CRM. When a trigger event occurs (like a new contact being created or a deal stage changing), 
                the workflow automatically performs actions like sending emails, updating records, or notifying your team.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6366f1', marginBottom: '0.25rem' }}>Common Triggers</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Contact created, Deal won, Invoice overdue, Task completed</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>Common Actions</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Send email, Create task, Update field, Notify team via Slack</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#f59e0b', marginBottom: '0.25rem' }}>Getting Started</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Click "Create Workflow" to build your first automation</div>
                </div>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                Loading workflows...
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: '#4c1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', padding: '1rem', color: '#fca5a5', marginBottom: '1rem' }}>
                Error: {error}
              </div>
            )}

            {!loading && !error && workflowsList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                <p style={{ marginBottom: '1rem' }}>No workflows yet. Create your first workflow to get started!</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {!loading && workflowsList.map(workflow => {
                const isActive = workflow.status === 'active';
                const triggerDisplay = workflow.trigger?(.type !== '' && .type != null) ? .type : 'N/A';
                const runsToday = workflow.stats?.totalRuns ?? 0;
                
                return (
                  <div key={workflow.id} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{workflow.name}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.75rem' }}>{(workflow.description !== '' && workflow.description != null) ? workflow.description : 'No description'}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                          <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.375rem', color: '#ccc' }}>
                            Trigger: {triggerDisplay}
                          </span>
                          <span style={{ padding: '0.25rem 0.75rem', backgroundColor: isActive ? '#0f4c0f' : '#4c4c4c', color: isActive ? '#4ade80' : '#999', borderRadius: '9999px', fontWeight: '600' }}>
                            {isActive ? 'Active' :(workflow.status !== '' && workflow.status != null) ? workflow.status : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #333' }}>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>Total runs: <span style={{ color: primaryColor, fontWeight: '600' }}>{runsToday}</span></div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => {
                            setEditingWorkflow(workflow);
                            setShowBuilder(true);
                          }}
                          style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                          style={{ padding: '0.5rem 1rem', backgroundColor: isActive ? '#4c3d0f' : primaryColor, color: isActive ? '#fbbf24' : '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
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
          onSave={async (workflow) => {
            try {
              const { getCurrentUser } = await import('@/lib/auth/auth-service');
              const currentUser = getCurrentUser();
              
              if (!currentUser) {
                throw new Error('Not authenticated');
              }

              const token = await currentUser.getIdToken();
              const isEditing = editingWorkflow && (editingWorkflow as any).id;
              const endpoint = isEditing 
                ? `/api/workflows/${(editingWorkflow as any).id}`
                : '/api/workflows';
              
              const method = isEditing ? 'PUT' : 'POST';
              
              const response = await fetch(endpoint, {
                method,
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  organizationId: orgId,
                  workspaceId: 'default',
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
            } catch (error: any) {
              console.error('Error saving workflow:', error);
              alert(`Failed to save workflow: ${error.message}`);
            }
          }}
          onCancel={() => {
            setShowBuilder(false);
            setEditingWorkflow(null);
          }}
        />
      )}
    </>
  );
}


