'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import FilterBuilder from '@/components/FilterBuilder';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import type { EntityFilter } from '@/types/filters';

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState('welcome');
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campaignFilters, setCampaignFilters] = useState<EntityFilter[]>([]);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);

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

  const templates = [
    { id: 'welcome', name: 'Welcome Email', description: 'Sent when a new contact is added', icon: '👋', type: 'automated' },
    { id: 'invoice', name: 'Invoice Email', description: 'Sent when an invoice is created', icon: '📄', type: 'automated' },
    { id: 'payment', name: 'Payment Confirmation', description: 'Sent when a payment is received', icon: '💳', type: 'automated' },
    { id: 'reminder', name: 'Payment Reminder', description: 'Sent before payment due date', icon: '⏰', type: 'automated' },
    { id: 'quote', name: 'Quote Email', description: 'Sent when a quote is generated', icon: '📝', type: 'automated' },
    { id: 'notification', name: 'Task Notification', description: 'Sent when a task is assigned', icon: '📋', type: 'automated' }
  ];

  const campaigns = [
    {
      id: 1,
      name: 'Monthly Newsletter - November',
      template: 'newsletter',
      status: 'sent',
      recipients: 1247,
      opened: 623,
      clicked: 156,
      sentDate: '2025-11-01',
      subject: 'November Updates & Special Offers'
    },
    {
      id: 2,
      name: 'Black Friday Sale',
      template: 'promotion',
      status: 'scheduled',
      recipients: 2341,
      scheduledDate: '2025-11-29 09:00',
      subject: 'Black Friday - 50% Off Everything!'
    },
    {
      id: 3,
      name: 'Re-engagement Campaign',
      template: 'reengagement',
      status: 'draft',
      recipients: 456,
      subject: 'We miss you! Come back for 20% off'
    },
    {
      id: 4,
      name: 'Product Launch Announcement',
      template: 'announcement',
      status: 'sending',
      recipients: 3421,
      sent: 2103,
      subject: 'Introducing Our New Product Line'
    }
  ];

  const [emailContent, setEmailContent] = useState({
    subject: 'Welcome to {{company_name}}!',
    body: `Hi {{contact_name}},

Welcome to {{company_name}}! We're excited to have you on board.

If you have any questions, feel free to reach out to our team at {{support_email}}.

Best regards,
{{company_name}} Team`
  });

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    subject: '',
    body: '',
    sendType: 'immediate' as 'immediate' | 'scheduled',
    scheduledDate: '',
    scheduledTime: ''
  });

  // Simulate estimating recipients based on filters
  React.useEffect(() => {
    if (campaignFilters.length > 0) {
      // In real implementation, this would query the backend
      setEstimatedRecipients(Math.floor(Math.random() * 2000) + 500);
    } else {
      setEstimatedRecipients(0);
    }
  }, [campaignFilters]);

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
            <Link
              href="/crm"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: '#999',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Email Marketing</h1>
                  <p style={{ color: '#666', fontSize: '0.875rem' }}>
                    Manage templates for automated emails and create targeted campaigns
                  </p>
                </div>
                {activeTab === 'campaigns' && (
                  <button
                    onClick={() => setShowCreateCampaign(true)}
                    style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    + Create Campaign
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #1a1a1a' }}>
              <button
                onClick={() => setActiveTab('templates')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: activeTab === 'templates' ? primaryColor : '#999',
                  border: 'none',
                  borderBottom: activeTab === 'templates' ? `2px solid ${primaryColor}` : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                📧 Automated Templates
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: activeTab === 'campaigns' ? primaryColor : '#999',
                  border: 'none',
                  borderBottom: activeTab === 'campaigns' ? `2px solid ${primaryColor}` : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                📊 Campaigns
              </button>
            </div>

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div style={{ display: 'flex', gap: '2rem' }}>
                {/* Template List */}
                <div style={{ width: '300px' }}>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>ℹ️ About Templates</div>
                    <div style={{ fontSize: '0.75rem', color: '#ccc', lineHeight: '1.5' }}>
                      These templates are used by automated workflows when events occur (e.g., invoice created, payment received).
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        style={{
                          padding: '1rem',
                          backgroundColor: selectedTemplate === template.id ? '#222' : 'transparent',
                          border: selectedTemplate === template.id ? `1px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{template.icon}</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{template.name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#999', paddingLeft: '2.25rem' }}>{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Editor */}
                <div style={{ flex: 1 }}>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={emailContent.subject}
                        onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Email Body
                      </label>
                      <textarea
                        value={emailContent.body}
                        onChange={(e) => setEmailContent({ ...emailContent, body: e.target.value })}
                        rows={12}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', marginBottom: '0.5rem' }}>Available Variables:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{contact_name}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{contact_email}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{company_name}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{support_email}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{invoice_number}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>{'{{amount}}'}</code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <button style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                        Send Test Email
                      </button>
                      <button style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                        Save Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
              <div>
                {/* Campaign Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Total Campaigns</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>4</div>
                  </div>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Avg Open Rate</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: primaryColor }}>49.9%</div>
                  </div>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Avg Click Rate</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>12.5%</div>
                  </div>
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Total Sent</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>7,465</div>
                  </div>
                </div>

                {/* Campaigns List */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333' }}>
                          <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Campaign</th>
                          <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Status</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Recipients</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Opens</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Clicks</th>
                          <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(campaign => {
                          const openRate = campaign.opened && campaign.recipients ? ((campaign.opened / campaign.recipients) * 100).toFixed(1) : '-';
                          const clickRate = campaign.clicked && campaign.recipients ? ((campaign.clicked / campaign.recipients) * 100).toFixed(1) : '-';
                          
                          return (
                            <tr key={campaign.id} style={{ borderBottom: '1px solid #222' }}>
                              <td style={{ padding: '1rem 0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{campaign.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#999' }}>{campaign.subject}</div>
                              </td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.75rem',
                                  backgroundColor: 
                                    campaign.status === 'sent' ? '#0f4c0f' :
                                    campaign.status === 'scheduled' ? '#4c3d0f' :
                                    campaign.status === 'sending' ? '#0f3d4c' :
                                    '#4c4c4c',
                                  color:
                                    campaign.status === 'sent' ? '#4ade80' :
                                    campaign.status === 'scheduled' ? '#fbbf24' :
                                    campaign.status === 'sending' ? '#22d3ee' :
                                    '#999',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  textTransform: 'capitalize'
                                }}>
                                  {campaign.status}
                                </span>
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#fff', textAlign: 'right', fontWeight: '600' }}>
                                {campaign.status === 'sending' ? `${campaign.sent}/${campaign.recipients}` : campaign.recipients.toLocaleString()}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc', textAlign: 'right' }}>
                                {campaign.opened ? `${campaign.opened.toLocaleString()} (${openRate}%)` : '-'}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc', textAlign: 'right' }}>
                                {campaign.clicked ? `${campaign.clicked.toLocaleString()} (${clickRate}%)` : '-'}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#999' }}>
                                {campaign.sentDate || campaign.scheduledDate || 'Draft'}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                    View
                                  </button>
                                  {campaign.status === 'draft' && (
                                    <button style={{ padding: '0.5rem 1rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                                      Send
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Create Email Campaign</h2>
            
            {/* Campaign Name */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Holiday Sale 2025"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
              />
            </div>

            {/* Email Content */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                Subject Line
              </label>
              <input
                type="text"
                value={newCampaign.subject}
                onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                placeholder="Special offer just for you, {{contact_name}}!"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                Email Body
              </label>
              <textarea
                value={newCampaign.body}
                onChange={(e) => setNewCampaign({ ...newCampaign, body: e.target.value })}
                rows={10}
                placeholder="Hi {{contact_name}},&#10;&#10;We have an exclusive offer for you...&#10;&#10;Best regards,&#10;{{company_name}}"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>

            {/* Recipient Filters */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#ccc' }}>
                  Target Audience (Filter Contacts)
                </label>
                {estimatedRecipients > 0 && (
                  <div style={{ fontSize: '0.875rem', color: primaryColor, fontWeight: '600' }}>
                    ~{estimatedRecipients.toLocaleString()} recipients
                  </div>
                )}
              </div>
              
              <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', padding: '1rem' }}>
                <FilterBuilder
                  schema={STANDARD_SCHEMAS.contacts}
                  filters={campaignFilters}
                  onChange={setCampaignFilters}
                />
                
                {campaignFilters.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#666', fontSize: '0.875rem' }}>
                    No filters set - campaign will be sent to all contacts
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#1a2e1a', border: '1px solid #2d4a2d', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#86efac' }}>
                💡 Use filters to target specific segments: new contacts, high-value customers, inactive users, by location, tags, or any custom field
              </div>
            </div>

            {/* Send Options */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.75rem' }}>
                Send Options
              </label>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setNewCampaign({ ...newCampaign, sendType: 'immediate' })}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: newCampaign.sendType === 'immediate' ? '#222' : '#0a0a0a',
                    border: newCampaign.sendType === 'immediate' ? `2px solid ${primaryColor}` : '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⚡ Send Immediately</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>Send to all recipients right away</div>
                </button>
                
                <button
                  onClick={() => setNewCampaign({ ...newCampaign, sendType: 'scheduled' })}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: newCampaign.sendType === 'scheduled' ? '#222' : '#0a0a0a',
                    border: newCampaign.sendType === 'scheduled' ? `2px solid ${primaryColor}` : '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>📅 Schedule for Later</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>Pick a specific date and time</div>
                </button>
              </div>

              {newCampaign.sendType === 'scheduled' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={newCampaign.scheduledDate}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduledDate: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={newCampaign.scheduledTime}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduledTime: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #333' }}>
              <button
                onClick={() => setShowCreateCampaign(false)}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Cancel
              </button>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    alert('Campaign saved as draft!');
                    setShowCreateCampaign(false);
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                >
                  Save as Draft
                </button>
                
                <button
                  onClick={() => {
                    const action = newCampaign.sendType === 'immediate' ? 'sent' : 'scheduled';
                    alert(`Campaign ${action} to ${estimatedRecipients} recipients!`);
                    setShowCreateCampaign(false);
                    setNewCampaign({ name: '', subject: '', body: '', sendType: 'immediate', scheduledDate: '', scheduledTime: '' });
                    setCampaignFilters([]);
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                >
                  {newCampaign.sendType === 'immediate' ? '📤 Send Now' : '📅 Schedule Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

