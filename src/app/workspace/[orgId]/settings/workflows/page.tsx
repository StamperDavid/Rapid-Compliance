'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import { Workflow } from '@/types/workflow';

export default function WorkflowsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);
  const [workflowsList, setWorkflowsList] = useState<any[]>([]);

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const workflows = [
    {
      id: 1,
      name: 'Auto-assign Hot Leads',
      description: 'Automatically assign leads with score > 80 to sales team',
      trigger: 'contact.created',
      active: true,
      runsToday: 12
    },
    {
      id: 2,
      name: 'Payment Reminder',
      description: 'Send reminder emails 3 days before invoice due date',
      trigger: 'schedule.daily',
      active: true,
      runsToday: 45
    },
    {
      id: 3,
      name: 'Deal Won Notification',
      description: 'Notify team in Slack when a deal is marked as won',
      trigger: 'deal.won',
      active: true,
      runsToday: 3
    },
    {
      id: 4,
      name: 'Inactive Contact Cleanup',
      description: 'Archive contacts with no activity for 365 days',
      trigger: 'schedule.weekly',
      active: false,
      runsToday: 0
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: sidebarOpen ? '260px' : '70px', backgroundColor: '#0a0a0a', borderRight: '1px solid #1a1a1a', transition: 'width 0.3s', display: 'flex', flexDirection: 'column' }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link href="/crm" style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>
            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link key={key} href={`/crm?view=${key}`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>
          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#999', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {workflowsList.map(workflow => (
                <div key={workflow.id} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{workflow.name}</h3>
                      <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.75rem' }}>{workflow.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.375rem', color: '#ccc' }}>
                          Trigger: {workflow.trigger}
                        </span>
                        <span style={{ padding: '0.25rem 0.75rem', backgroundColor: workflow.active ? '#0f4c0f' : '#4c4c4c', color: workflow.active ? '#4ade80' : '#999', borderRadius: '9999px', fontWeight: '600' }}>
                          {workflow.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #333' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Runs today: <span style={{ color: primaryColor, fontWeight: '600' }}>{workflow.runsToday}</span></div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => {
                          setEditingWorkflow(workflow as any);
                          setShowBuilder(true);
                        }}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => alert(`Workflow ${workflow.active ? 'paused' : 'activated'}`)} style={{ padding: '0.5rem 1rem', backgroundColor: workflow.active ? '#4c3d0f' : primaryColor, color: workflow.active ? '#fbbf24' : '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        {workflow.active ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showBuilder && (
        <WorkflowBuilder
          workflow={editingWorkflow}
          onSave={(workflow) => {
            // MOCK: Save workflow (will be replaced with API call)
            if (editingWorkflow && (editingWorkflow as any).id) {
              // Update existing
              setWorkflowsList(workflowsList.map(w => 
                (w as any).id === (editingWorkflow as any).id 
                  ? { ...w, ...workflow } as any
                  : w
              ));
            } else {
              // Create new
              const newWorkflow = {
                ...workflow,
                id: workflowsList.length + 1,
                active: true,
                runsToday: 0,
              };
              setWorkflowsList([...workflowsList, newWorkflow as any]);
            }
            setShowBuilder(false);
            setEditingWorkflow(null);
          }}
          onCancel={() => {
            setShowBuilder(false);
            setEditingWorkflow(null);
          }}
        />
      )}
    </div>
  );
}


