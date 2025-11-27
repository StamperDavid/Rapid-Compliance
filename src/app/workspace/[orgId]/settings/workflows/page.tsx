'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function WorkflowsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);

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
                <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Workflows</h1>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>Automation rules and workflow configuration</p>
              </div>
              <button style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                + Create Workflow
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {workflows.map(workflow => (
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
                      <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
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
    </div>
  );
}


