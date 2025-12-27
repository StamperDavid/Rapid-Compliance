'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function WebhooksPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useOrgTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);


  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const webhooks = [
    {
      id: 1,
      name: 'Contact Created Hook',
      url: 'https://api.example.com/webhooks/contact-created',
      events: ['contact.created'],
      active: true,
      lastTriggered: '2 hours ago'
    },
    {
      id: 2,
      name: 'Invoice Payment Hook',
      url: 'https://api.example.com/webhooks/invoice-paid',
      events: ['invoice.paid', 'invoice.created'],
      active: true,
      lastTriggered: '1 day ago'
    },
    {
      id: 3,
      name: 'Deal Stage Changed',
      url: 'https://api.example.com/webhooks/deal-updated',
      events: ['deal.stage_changed'],
      active: false,
      lastTriggered: 'Never'
    }
  ];

  const availableEvents = [
    { group: 'Contacts', events: ['contact.created', 'contact.updated', 'contact.deleted'] },
    { group: 'Deals', events: ['deal.created', 'deal.updated', 'deal.stage_changed', 'deal.won', 'deal.lost'] },
    { group: 'Invoices', events: ['invoice.created', 'invoice.paid', 'invoice.overdue', 'invoice.cancelled'] },
    { group: 'Tasks', events: ['task.created', 'task.completed', 'task.assigned'] }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
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

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Webhooks</h1>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>
                  Configure webhooks for real-time event notifications
                </p>
              </div>
              <button onClick={() => setShowCreateModal(true)} style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                + Create Webhook
              </button>
            </div>

            {/* Explanation Box */}
            <div style={{ backgroundColor: '#1a1a3a', border: '1px solid #3333aa', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔗</span> What are Webhooks?
              </h3>
              <p style={{ color: '#a0a0c0', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                Webhooks allow your CRM to send real-time notifications to external systems when events occur. 
                For example, when a new contact is created or a deal is won, we can instantly notify your other tools.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6366f1', marginBottom: '0.25rem' }}>Example Use Case</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Send a Slack message when a deal is won</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>Example Use Case</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Sync new contacts to your email platform</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#f59e0b', marginBottom: '0.25rem' }}>Example Use Case</div>
                  <div style={{ fontSize: '0.875rem', color: '#ccc' }}>Trigger automations in Zapier or Make</div>
                </div>
              </div>
            </div>

            {/* Webhooks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {webhooks.map(webhook => (
                <div key={webhook.id} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff' }}>{webhook.name}</h3>
                        <span style={{ padding: '0.25rem 0.75rem', backgroundColor: webhook.active ? '#0f4c0f' : '#4c4c4c', color: webhook.active ? '#4ade80' : '#999', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                          {webhook.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#999', fontFamily: 'monospace', marginBottom: '0.75rem' }}>{webhook.url}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {webhook.events.map(event => (
                          <span key={event} style={{ padding: '0.25rem 0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#ccc' }}>
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Edit
                      </button>
                      <button style={{ padding: '0.5rem 1rem', backgroundColor: '#4c0f0f', color: '#f87171', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Last triggered: {webhook.lastTriggered}</div>
                </div>
              ))}
            </div>

            {/* Available Events Reference */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginTop: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Available Events</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {availableEvents.map(group => (
                  <div key={group.group}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>{group.group}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {group.events.map(event => (
                        <code key={event} style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'monospace', padding: '0.25rem 0.5rem', backgroundColor: '#0a0a0a', borderRadius: '0.25rem' }}>
                          {event}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Create Webhook</h2>
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>Webhook Name</label>
                <input type="text" placeholder="My Webhook" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>Endpoint URL</label>
                <input type="url" placeholder="https://your-api.com/webhook" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>Events to Subscribe</label>
                <div style={{ padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {availableEvents.map(group => (
                    <div key={group.group} style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', marginBottom: '0.5rem' }}>{group.group}</div>
                      {group.events.map(event => (
                        <label key={event} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', color: '#ccc' }}>
                          <input type="checkbox" style={{ cursor: 'pointer' }} />
                          <code style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{event}</code>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                Cancel
              </button>
              <button onClick={() => { alert('Webhook created!'); setShowCreateModal(false); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                Create Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

























