'use client';

/* eslint-disable no-alert -- This admin UI uses native dialogs for quick user confirmations. Replace with modal components in production. */
/* eslint-disable @next/next/no-img-element -- Email template images use blob URLs from FileReader which don't work with next/image. */

import React, { useState } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import FilterBuilder from '@/components/FilterBuilder';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import type { ViewFilter } from '@/types/filters';
import { sendEmail } from '@/lib/email/email-service';
import { sendSMS as _sendSMS } from '@/lib/sms/sms-service';

// Type definitions for email template designer
// Using a flat interface since the code accesses properties after type checking block.type
// but TypeScript doesn't narrow the content type in this pattern
interface SocialLink {
  platform: string;
  url: string;
}

interface BlockContent {
  // Hero block
  imageUrl?: string;
  linkUrl?: string;
  height?: string;
  // Text block
  text?: string;
  align?: string;
  fontSize?: string;
  color?: string;
  // Button block
  url?: string;
  bgColor?: string;
  textColor?: string;
  width?: string;
  // Image block
  alt?: string;
  // ProductGrid block
  columns?: number;
  productIds?: string[];
  showPrice?: boolean;
  showButton?: boolean;
  // Divider block
  thickness?: string;
  style?: string;
  // Social block
  links?: SocialLink[];
  iconSize?: string;
  // Html block
  html?: string;
}

type BlockType = 'hero' | 'text' | 'button' | 'image' | 'productGrid' | 'divider' | 'spacer' | 'social' | 'html';

interface DesignerBlock {
  id: string;
  type: BlockType;
  content: BlockContent;
}

interface CustomTemplate {
  id: string;
  name: string;
  type: string;
  html: string;
  blocks: DesignerBlock[];
  preview?: string;
}

interface UploadedAsset {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: Date;
}

interface SmsTemplate {
  id: string;
  name: string;
  message: string;
  trigger: string;
  isCustom: boolean;
}

export default function EmailTemplatesPage() {
  const { user: _user } = useAuth();
    const { theme } = useOrgTheme();
  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns' | 'designer' | 'sms'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState('welcome');
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campaignFilters, setCampaignFilters] = useState<ViewFilter[]>([]);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [editingCustomTemplate, setEditingCustomTemplate] = useState<CustomTemplate | null>(null);
  const [showDesigner, setShowDesigner] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<DesignerBlock | null>(null);
  const [designerBlocks, setDesignerBlocks] = useState<DesignerBlock[]>([]);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState('order-shipped');
  const [smsContent, setSmsContent] = useState('');
  const [showSmsCustomTrigger, setShowSmsCustomTrigger] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);


  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // Contact fields for filter builder
  const contactFields: Array<{ key: string; label: string; type: string; options?: string[] }> = STANDARD_SCHEMAS.contacts.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: field.type,
    options: ('options' in field && field.options) ? field.options as string[] : undefined
  }));

  const baseTemplates = [
    { id: 'welcome', name: 'Welcome Email', description: 'Sent when a new contact is added', icon: '👋', type: 'automated' },
    { id: 'invoice', name: 'Invoice Email', description: 'Sent when an invoice is created', icon: '📄', type: 'automated' },
    { id: 'payment', name: 'Payment Confirmation', description: 'Sent when a payment is received', icon: '💳', type: 'automated' },
    { id: 'reminder', name: 'Payment Reminder', description: 'Sent before payment due date', icon: '⏰', type: 'automated' },
    { id: 'quote', name: 'Quote Email', description: 'Sent when a quote is generated', icon: '📝', type: 'automated' },
    { id: 'notification', name: 'Task Notification', description: 'Sent when a task is assigned', icon: '📋', type: 'automated' }
  ];

  // Combine base templates with custom templates
  const templates = [
    ...baseTemplates,
    ...customTemplates.map(ct => ({
      id: ct.id,
      name: ct.name,
      description: 'Custom designed template',
      icon: '🎨',
      type: 'custom'
    }))
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

  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([
    { id: 'order-shipped', name: 'Order Shipped', message: 'Your order #{orderNumber} has shipped! Track it here: {trackingLink}', trigger: 'order_shipped', isCustom: false },
    { id: 'appointment-reminder', name: 'Appointment Reminder', message: 'Reminder: You have an appointment tomorrow at {time}. Reply CONFIRM to confirm.', trigger: 'appointment_reminder', isCustom: false },
    { id: 'payment-received', name: 'Payment Received', message: 'Payment of {amount} received. Thank you!', trigger: 'payment_received', isCustom: false }
  ]);

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
    templateId: '',
    sendType: 'immediate' as 'immediate' | 'scheduled',
    scheduledDate: '',
    scheduledTime: ''
  });

  // Estimate recipients based on filters
  React.useEffect(() => {
    async function updateEstimatedRecipients() {
      if (campaignFilters.length === 0) {
        setEstimatedRecipients(0);
        return;
      }

      try {
        const response = await fetch('/api/contacts/count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'default',
            filters: campaignFilters
          })
        });

        if (response.ok) {
          const data: { count?: number } = await response.json() as { count?: number };
          setEstimatedRecipients(data.count ?? 0);
        } else {
          setEstimatedRecipients(0);
        }
      } catch (error) {
        console.error('Error estimating recipients:', error);
        setEstimatedRecipients(0);
      }
    }

    void updateEstimatedRecipients();
  }, [campaignFilters]);

  return (
    <>
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
              <Link href={`/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Email Marketing</h1>
                  <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                    Manage templates for automated emails and create targeted campaigns
                  </p>
                </div>
                {activeTab === 'campaigns' && (
                  <button
                    onClick={() => setShowCreateCampaign(true)}
                    style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    + Create Campaign
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <button
                onClick={() => setActiveTab('templates')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: activeTab === 'templates' ? primaryColor : 'var(--color-text-secondary)',
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
                onClick={() => setActiveTab('designer')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: activeTab === 'designer' ? primaryColor : 'var(--color-text-secondary)',
                  border: 'none',
                  borderBottom: activeTab === 'designer' ? `2px solid ${primaryColor}` : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                🎨 Custom Templates
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: activeTab === 'campaigns' ? primaryColor : 'var(--color-text-secondary)',
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
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>ℹ️ About Templates</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
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
                          backgroundColor: selectedTemplate === template.id ? 'var(--color-bg-elevated)' : 'transparent',
                          border: selectedTemplate === template.id ? `1px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{template.icon}</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{template.name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', paddingLeft: '2.25rem' }}>{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Editor */}
                <div style={{ flex: 1 }}>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={emailContent.subject}
                        onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Email Body
                      </label>
                      <textarea
                        value={emailContent.body}
                        onChange={(e) => setEmailContent({ ...emailContent, body: e.target.value })}
                        rows={12}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', fontFamily: 'monospace', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Available Variables:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{contact_name}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{contact_email}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{company_name}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{support_email}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{invoice_number}}'}</code>
                        <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>{'{{amount}}'}</code>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Test Email Address
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="email"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          placeholder="your@email.com"
                          style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                        />
                        <button
                          onClick={() => {
                            if (!testEmailAddress) {
                               
                              alert('Please enter a test email address');
                              return;
                            }
                            setIsSendingTest(true);
                            setTestEmailResult(null);

                            void (async () => {
                              try {
                                // Replace variables in email content
                                let processedSubject = emailContent.subject;
                                let processedBody = emailContent.body;
                                const variables: Record<string, string> = {
                                  contact_name: 'Test User',
                                  contact_email: testEmailAddress,
                                  company_name: 'Test Company',
                                  support_email: 'support@test.com',
                                  invoice_number: 'INV-001',
                                  amount: '$1,000.00',
                                };
                                for (const [key, value] of Object.entries(variables)) {
                                  processedSubject = processedSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
                                  processedBody = processedBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
                                }

                                const result = await sendEmail({
                                  to: testEmailAddress,
                                  subject: processedSubject,
                                  html: processedBody.replace(/\n/g, '<br>'),
                                  text: processedBody,
                                  tracking: {
                                    trackOpens: true,
                                    trackClicks: true,
                                  },
                                });

                                if (result.success) {
                                  setTestEmailResult({ success: true, message: `Test email sent! Message ID: ${result.messageId}` });
                                  setTestEmailAddress('');
                                } else {
                                  setTestEmailResult({ success: false, message: (result.error !== '' && result.error != null) ? result.error : 'Failed to send email' });
                                }
                              } catch (error) {
                                const message = error instanceof Error ? error.message : 'Failed to send email';
                                setTestEmailResult({ success: false, message });
                              } finally {
                                setIsSendingTest(false);
                              }
                            })();
                          }}
                          disabled={isSendingTest || !testEmailAddress}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: isSendingTest || !testEmailAddress ? 'var(--color-border-main)' : 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            cursor: isSendingTest || !testEmailAddress ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isSendingTest ? 'Sending...' : 'Send Test Email'}
                        </button>
                      </div>
                      {testEmailResult && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: testEmailResult.success ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
                          border: `1px solid ${testEmailResult.success ? 'var(--color-success-light)' : 'var(--color-error-light)'}`,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          color: testEmailResult.success ? 'var(--color-success-light)' : 'var(--color-error-light)'
                        }}>
                          {testEmailResult.success ? '✓ ' : '✗ '}
                          {testEmailResult.message}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <button style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                        Save Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Templates Designer Tab */}
            {activeTab === 'designer' && (
              <div>
                {!showDesigner ? (
                  <>
                    {/* Custom Templates Library */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Custom Email Templates</h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Design beautiful promotional emails and use them in automated workflows</p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingCustomTemplate({
                            id: `custom_${Date.now()}`,
                            name: 'New Custom Template',
                            type: 'custom',
                            html: '',
                            blocks: []
                          });
                          setDesignerBlocks([]);
                          setShowDesigner(true);
                        }}
                        style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                      >
                        + Create Custom Template
                      </button>
                    </div>

                    {customTemplates.length === 0 ? (
                      <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '2px dashed var(--color-border-strong)', borderRadius: '1rem', padding: '4rem 2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎨</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>No custom templates yet</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>Create beautiful, Amazon-style promotional emails with our visual designer</p>
                        <button
                          onClick={() => {
                            setEditingCustomTemplate({
                              id: `custom_${Date.now()}`,
                              name: 'New Custom Template',
                              type: 'custom',
                              html: '',
                              blocks: []
                            });
                            setShowDesigner(true);
                          }}
                          style={{ padding: '0.75rem 2rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                        >
                          Create Your First Template
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {customTemplates.map((template) => (
                          <div key={template.id} style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                            {/* Preview */}
                            <div style={{ height: '200px', backgroundColor: 'var(--color-bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border-strong)' }}>
                              {template.preview ? (
                                <img src={template.preview} alt={template.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ textAlign: 'center', color: 'var(--color-text-disabled)' }}>
                                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📧</div>
                                  <div style={{ fontSize: '0.875rem' }}>Email Preview</div>
                                </div>
                              )}
                            </div>
                            {/* Info */}
                            <div style={{ padding: '1.25rem' }}>
                              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>{template.name}</h3>
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Last edited: {new Date().toLocaleDateString()}</p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => {
                                    setEditingCustomTemplate(template);
                                    setDesignerBlocks(template.blocks ?? []);
                                    setShowDesigner(true);
                                  }}
                                  style={{ flex: 1, padding: '0.625rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this template?')) {
                                      setCustomTemplates(customTemplates.filter(t => t.id !== template.id));
                                    }
                                  }}
                                  style={{ padding: '0.625rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-error)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Visual Email Designer */
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', overflow: 'hidden' }}>
                    {/* Designer Header */}
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          value={editingCustomTemplate?.name ?? ''}
                          onChange={(e) => editingCustomTemplate && setEditingCustomTemplate({ ...editingCustomTemplate, name: e.target.value })}
                          style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                          placeholder="Template Name"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                          onClick={() => setShowDesigner(false)}
                          style={{ padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!editingCustomTemplate) {
                              return;
                            }
                            // Generate HTML from blocks
                            let generatedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${editingCustomTemplate.name}</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  </style>
</head>
<body>
  <div class="email-container">
`;
                            
                            designerBlocks.forEach(block => {
                              if (block.type === 'hero' && block.content.imageUrl) {
                                const link = block.content.linkUrl ? `<a href="${block.content.linkUrl}">` : '';
                                const linkClose = block.content.linkUrl ? '</a>' : '';
                                generatedHtml += `
    <div style="width: 100%; height: ${(block.content.height !== '' && block.content.height != null) ? block.content.height : '400px'}; overflow: hidden;">
      ${link}<img src="${block.content.imageUrl}" alt="Hero" style="width: 100%; height: 100%; object-fit: cover; display: block;" />${linkClose}
    </div>`;
                              }
                              
                              if (block.type === 'text') {
                                generatedHtml += `
    <div style="padding: 20px; font-size: ${(block.content.fontSize !== '' && block.content.fontSize != null) ? block.content.fontSize : '16px'}; color: ${(block.content.color !== '' && block.content.color != null) ? block.content.color : 'var(--color-bg-main)'}; text-align: ${(block.content.align !== '' && block.content.align != null) ? block.content.align : 'left'};">
      ${block.content.text ?? ''}
    </div>`;
                              }
                              
                              if (block.type === 'button') {
                                generatedHtml += `
    <div style="padding: 20px; text-align: center;">
      <a href="${(block.content.url !== '' && block.content.url != null) ? block.content.url : '#'}" style="display: inline-block; padding: 14px 40px; background-color: ${(block.content.bgColor !== '' && block.content.bgColor != null) ? block.content.bgColor : primaryColor}; color: ${(block.content.textColor !== '' && block.content.textColor != null) ? block.content.textColor : 'var(--color-text-primary)'}; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        ${(block.content.text !== '' && block.content.text != null) ? block.content.text : 'Button'}
      </a>
    </div>`;
                              }
                              
                              if (block.type === 'image' && block.content.imageUrl) {
                                const link = block.content.linkUrl ? `<a href="${block.content.linkUrl}">` : '';
                                const linkClose = block.content.linkUrl ? '</a>' : '';
                                generatedHtml += `
    <div style="padding: 10px;">
      ${link}<img src="${block.content.imageUrl}" alt="${(block.content.alt !== '' && block.content.alt != null) ? block.content.alt : 'Image'}" style="width: ${(block.content.width !== '' && block.content.width != null) ? block.content.width : '100%'}; height: auto; display: block;" />${linkClose}
    </div>`;
                              }
                              
                              if (block.type === 'divider') {
                                generatedHtml += `
    <div style="padding: 10px 20px;">
      <hr style="border: none; border-top: ${(block.content.thickness !== '' && block.content.thickness != null) ? block.content.thickness : '1px'} ${(block.content.style !== '' && block.content.style != null) ? block.content.style : 'solid'} ${(block.content.color !== '' && block.content.color != null) ? block.content.color : 'var(--color-text-secondary)'}; margin: 0;" />
    </div>`;
                              }
                              
                              if (block.type === 'spacer') {
                                generatedHtml += `
    <div style="height: ${(block.content.height !== '' && block.content.height != null) ? block.content.height : '40px'};"></div>`;
                              }
                              
                              if (block.type === 'html') {
                                generatedHtml += block.content.html ?? '';
                              }
                            });
                            
                            generatedHtml += `
  </div>
</body>
</html>`;
                            
                            // Save template with generated HTML
                            const savedTemplate: CustomTemplate = {
                              id: editingCustomTemplate.id,
                              name: editingCustomTemplate.name,
                              type: editingCustomTemplate.type,
                              html: generatedHtml,
                              blocks: designerBlocks,
                              preview: editingCustomTemplate.preview,
                            };

                            const updated: CustomTemplate[] = customTemplates.find(t => t.id === editingCustomTemplate.id)
                              ? customTemplates.map(t => t.id === editingCustomTemplate.id ? savedTemplate : t)
                              : [...customTemplates, savedTemplate];

                            setCustomTemplates(updated);
                            setShowDesigner(false);
                            setSelectedBlock(null);
                            alert('✅ Template saved successfully! You can now use it in automated workflows and campaigns.');
                          }}
                          style={{ padding: '0.625rem 1.25rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                        >
                          💾 Save Template
                        </button>
                      </div>
                    </div>

                    {/* Designer Content */}
                    <div style={{ display: 'flex', minHeight: '600px' }}>
                      {/* Tools Sidebar */}
                      <div style={{ width: '280px', backgroundColor: 'var(--color-bg-main)', borderRight: '1px solid var(--color-border-strong)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* Upload Assets */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-strong)' }}>
                          <button
                            onClick={() => setShowAssetLibrary(true)}
                            style={{ width: '100%', padding: '0.875rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}
                          >
                            📁 Asset Library
                          </button>
                          <label style={{ display: 'block', width: '100%', padding: '0.875rem', backgroundColor: 'var(--color-bg-paper)', border: '1px dashed var(--color-text-disabled)', borderRadius: '0.5rem', textAlign: 'center', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                const newAssets = files.map(file => ({
                                  id: `asset_${Date.now()}_${Math.random()}`,
                                  name: file.name,
                                  url: URL.createObjectURL(file),
                                  type: 'image',
                                  uploadedAt: new Date()
                                }));
                                setUploadedAssets([...uploadedAssets, ...newAssets]);
                                alert(`${files.length} image(s) uploaded to your library!`);
                              }}
                              style={{ display: 'none' }}
                            />
                            ⬆️ Upload Images
                          </label>
                        </div>

                        {/* Design Elements */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase' }}>Design Elements</h3>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'hero',
                                  content: { imageUrl: '', linkUrl: '', height: '400px' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>🖼️ Hero Image</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Full-width banner</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'text',
                                  content: { text: 'Enter your text here...', align: 'left', fontSize: '16px', color: 'var(--color-bg-main)' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>📝 Text Block</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Headline / Paragraph</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'button',
                                  content: { text: 'Click Here', url: '', bgColor: primaryColor, textColor: 'var(--color-text-primary)', width: 'auto' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>🔘 Button</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Call-to-action</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'image',
                                  content: { imageUrl: '', alt: '', width: '100%', linkUrl: '' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>📷 Image</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>From your library</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'productGrid',
                                  content: { columns: 3, productIds: [], showPrice: true, showButton: true }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>🛍️ Product Grid</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>2-4 columns</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'divider',
                                  content: { color: 'var(--color-text-secondary)', thickness: '1px', style: 'solid' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>➖ Divider</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Horizontal line</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'spacer',
                                  content: { height: '40px' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>⬜ Spacer</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Add spacing</div>
                            </button>
                            
                            <button
                              onClick={() => {
                                const newBlock: DesignerBlock = {
                                  id: `block_${Date.now()}`,
                                  type: 'social',
                                  content: { links: [{ platform: 'facebook', url: '' }, { platform: 'twitter', url: '' }, { platform: 'instagram', url: '' }], iconSize: '32px' }
                                };
                                setDesignerBlocks([...designerBlocks, newBlock]);
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>🔗 Social Links</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Icons + URLs</div>
                            </button>

                            <button
                              onClick={() => {
                                const html = prompt('Paste your custom HTML here:');
                                if (html) {
                                  const newBlock: DesignerBlock = {
                                    id: `block_${Date.now()}`,
                                    type: 'html',
                                    content: { html }
                                  };
                                  setDesignerBlocks([...designerBlocks, newBlock]);
                                }
                              }}
                              style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)'}
                            >
                              <div style={{ marginBottom: '0.25rem' }}>💻 Custom HTML</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Paste code</div>
                            </button>
                          </div>
                        </div>

                        {/* Pro Tip */}
                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border-strong)' }}>
                          <div style={{ padding: '1rem', backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success)', borderRadius: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-success-light)', marginBottom: '0.5rem', fontWeight: '600' }}>💡 Pro Tip</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-success-light)', lineHeight: '1.4' }}>
                              Use {`{{customer_name}}`}, {`{{product_name}}`} to personalize!
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Canvas */}
                      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: 'var(--color-bg-elevated)' }}>
                        <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'var(--color-text-primary)', minHeight: '600px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                          {designerBlocks.length === 0 ? (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
                              <p style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--color-text-disabled)' }}>Start building your email</p>
                              <p style={{ fontSize: '0.875rem' }}>Click elements on the left to add them to your design</p>
                              <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--color-info-light)', border: '1px solid var(--color-info-light)', borderRadius: '0.5rem', color: 'var(--color-info-dark)', fontSize: '0.875rem' }}>
                                Upload your images first, then drag them into image blocks!
                              </div>
                            </div>
                          ) : (
                            designerBlocks.map((block, index) => (
                              <div
                                key={block.id}
                                onClick={() => setSelectedBlock(block)}
                                style={{
                                  position: 'relative',
                                  cursor: 'pointer',
                                  border: selectedBlock?.id === block.id ? `2px solid ${primaryColor}` : '2px solid transparent',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {/* Block Content */}
                                {block.type === 'hero' && (
                                  <div style={{ width: '100%', height: (block.content.height !== '' && block.content.height != null) ? block.content.height : '400px', backgroundColor: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    {block.content.imageUrl ? (
                                      <img src={block.content.imageUrl} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🖼️</div>
                                        <div>Click to select an image</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {block.type === 'text' && (
                                  <div style={{ padding: '20px', fontSize: (block.content.fontSize !== '' && block.content.fontSize != null) ? block.content.fontSize : '16px', color: (block.content.color !== '' && block.content.color != null) ? block.content.color : 'var(--color-bg-main)', textAlign: ((block.content.align !== '' && block.content.align != null) ? block.content.align : 'left') as React.CSSProperties['textAlign'] }}>
                                    {(block.content.text !== '' && block.content.text != null) ? block.content.text : 'Text block'}
                                  </div>
                                )}
                                
                                {block.type === 'button' && (
                                  <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <a href={(block.content.url !== '' && block.content.url != null) ? block.content.url : '#'} style={{ display: 'inline-block', padding: '14px 40px', backgroundColor: (block.content.bgColor !== '' && block.content.bgColor != null) ? block.content.bgColor : primaryColor, color: (block.content.textColor !== '' && block.content.textColor != null) ? block.content.textColor : 'var(--color-text-primary)', textDecoration: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '16px' }}>
                                      {(block.content.text !== '' && block.content.text != null) ? block.content.text : 'Button'}
                                    </a>
                                  </div>
                                )}
                                
                                {block.type === 'image' && (
                                  <div style={{ padding: '10px' }}>
                                    {block.content.imageUrl ? (
                                      <img src={block.content.imageUrl} alt={(block.content.alt !== '' && block.content.alt != null) ? block.content.alt : 'Image'} style={{ width: (block.content.width !== '' && block.content.width != null) ? block.content.width : '100%', height: 'auto', display: 'block' }} />
                                    ) : (
                                      <div style={{ backgroundColor: 'var(--color-border-light)', padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
                                        <div>Click to select an image</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {block.type === 'productGrid' && (
                                  <div style={{ padding: '20px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.content.columns ?? 3}, 1fr)`, gap: '15px' }}>
                                      {[1, 2, 3].map(i => (
                                        <div key={i} style={{ border: '1px dashed var(--color-border-light)', padding: '15px', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                          <div style={{ backgroundColor: 'var(--color-bg-elevated)', height: '120px', marginBottom: '10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🛍️</div>
                                          <div>Product {i}</div>
                                          {block.content.showPrice && <div style={{ fontWeight: 'bold', color: 'var(--color-bg-main)' }}>$99.99</div>}
                                          {block.content.showButton && (
                                            <div style={{ marginTop: '10px', padding: '8px', backgroundColor: primaryColor, color: 'var(--color-text-primary)', borderRadius: '4px', fontSize: '0.75rem' }}>Shop Now</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {block.type === 'divider' && (
                                  <div style={{ padding: '10px 20px' }}>
                                    <hr style={{ border: 'none', borderTop: `${(block.content.thickness !== '' && block.content.thickness != null) ? block.content.thickness : '1px'} ${(block.content.style !== '' && block.content.style != null) ? block.content.style : 'solid'} ${(block.content.color !== '' && block.content.color != null) ? block.content.color : 'var(--color-text-secondary)'}`, margin: 0 }} />
                                  </div>
                                )}
                                
                                {block.type === 'spacer' && (
                                  <div style={{ height: (block.content.height !== '' && block.content.height != null) ? block.content.height : '40px', backgroundColor: 'transparent' }} />
                                )}
                                
                                {block.type === 'social' && (
                                  <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: '15px' }}>
                                      {(block.content.links ?? []).map((link: SocialLink, i: number) => (
                                        <div key={i} style={{ width: (block.content.iconSize !== '' && block.content.iconSize != null) ? block.content.iconSize : '32px', height: (block.content.iconSize !== '' && block.content.iconSize != null) ? block.content.iconSize : '32px', backgroundColor: 'var(--color-info)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)', fontSize: '16px' }}>
                                          {link.platform[0].toUpperCase()}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {block.type === 'html' && (
                                  <div dangerouslySetInnerHTML={{ __html: block.content.html ?? '' }} />
                                )}
                                
                                {/* Block Actions */}
                                {selectedBlock?.id === block.id && (
                                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', backgroundColor: 'rgba(0,0,0,0.8)', padding: '6px', borderRadius: '6px' }}>
                                    {index > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newBlocks = [...designerBlocks];
                                          [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
                                          setDesignerBlocks(newBlocks);
                                        }}
                                        style={{ padding: '4px 8px', backgroundColor: 'var(--color-text-primary)', color: 'var(--color-bg-main)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {index < designerBlocks.length - 1 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newBlocks = [...designerBlocks];
                                          [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
                                          setDesignerBlocks(newBlocks);
                                        }}
                                        style={{ padding: '4px 8px', backgroundColor: 'var(--color-text-primary)', color: 'var(--color-bg-main)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                      >
                                        ↓
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Delete this block?')) {
                                          setDesignerBlocks(designerBlocks.filter(b => b.id !== block.id));
                                          setSelectedBlock(null);
                                        }
                                      }}
                                      style={{ padding: '4px 8px', backgroundColor: 'var(--color-error)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Properties Panel */}
                      <div style={{ width: '320px', backgroundColor: 'var(--color-bg-main)', borderLeft: '1px solid var(--color-border-strong)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {selectedBlock ? (
                          /* Block Settings */
                          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                                {selectedBlock.type === 'hero' && '🖼️ Hero Image'}
                                {selectedBlock.type === 'text' && '📝 Text Block'}
                                {selectedBlock.type === 'button' && '🔘 Button'}
                                {selectedBlock.type === 'image' && '📷 Image'}
                                {selectedBlock.type === 'productGrid' && '🛍️ Product Grid'}
                                {selectedBlock.type === 'divider' && '➖ Divider'}
                                {selectedBlock.type === 'spacer' && '⬜ Spacer'}
                                {selectedBlock.type === 'social' && '🔗 Social Links'}
                              </h3>
                              <button
                                onClick={() => setSelectedBlock(null)}
                                style={{ padding: '4px 8px', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                ✕
                              </button>
                            </div>

                            {/* Hero Image Settings */}
                            {selectedBlock.type === 'hero' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                                    Banner Image
                                  </label>
                                  {selectedBlock.content.imageUrl ? (
                                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                      <img src={selectedBlock.content.imageUrl} alt="Preview" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }} />
                                      <button
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, imageUrl: '' } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, imageUrl: '' } });
                                        }}
                                        style={{ position: 'absolute', top: '6px', right: '6px', padding: '4px 8px', backgroundColor: 'var(--color-error)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : null}
                                  <button
                                    onClick={() => setShowAssetLibrary(true)}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px dashed var(--color-text-disabled)', borderRadius: '0.5rem', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}
                                  >
                                    📁 Choose from Library
                                  </button>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Link URL (optional)
                                  </label>
                                  <input
                                    type="url"
                                    value={selectedBlock.content.linkUrl ?? ''}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, linkUrl: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, linkUrl: e.target.value } });
                                    }}
                                    placeholder="https://yoursite.com/sale"
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  />
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Height
                                  </label>
                                  <select
                                    value={(selectedBlock.content.height !== '' && selectedBlock.content.height != null) ? selectedBlock.content.height : '400px'}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, height: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, height: e.target.value } });
                                    }}
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  >
                                    <option value="300px">Small (300px)</option>
                                    <option value="400px">Medium (400px)</option>
                                    <option value="500px">Large (500px)</option>
                                    <option value="600px">Extra Large (600px)</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {/* Text Block Settings */}
                            {selectedBlock.type === 'text' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Text Content
                                  </label>
                                  <textarea
                                    value={selectedBlock.content.text ?? ''}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, text: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, text: e.target.value } });
                                    }}
                                    rows={5}
                                    placeholder="Enter your text here... Use {{customer_name}} for personalization"
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', resize: 'vertical' }}
                                  />
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Text Size
                                  </label>
                                  <select
                                    value={(selectedBlock.content.fontSize !== '' && selectedBlock.content.fontSize != null) ? selectedBlock.content.fontSize : '16px'}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, fontSize: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, fontSize: e.target.value } });
                                    }}
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  >
                                    <option value="12px">Small (12px)</option>
                                    <option value="14px">Regular (14px)</option>
                                    <option value="16px">Medium (16px)</option>
                                    <option value="20px">Large (20px)</option>
                                    <option value="24px">Heading (24px)</option>
                                    <option value="32px">Big Heading (32px)</option>
                                  </select>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Text Color
                                  </label>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                      type="color"
                                      value={(selectedBlock.content.color !== '' && selectedBlock.content.color != null) ? selectedBlock.content.color : 'var(--color-bg-main)'}
                                      onChange={(e) => {
                                        const newBlocks = designerBlocks.map(b => 
                                          b.id === selectedBlock.id ? { ...b, content: { ...b.content, color: e.target.value } } : b
                                        );
                                        setDesignerBlocks(newBlocks);
                                        setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, color: e.target.value } });
                                      }}
                                      style={{ width: '60px', height: '40px', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer' }}
                                    />
                                    <input
                                      type="text"
                                      value={(selectedBlock.content.color !== '' && selectedBlock.content.color != null) ? selectedBlock.content.color : 'var(--color-bg-main)'}
                                      onChange={(e) => {
                                        const newBlocks = designerBlocks.map(b => 
                                          b.id === selectedBlock.id ? { ...b, content: { ...b.content, color: e.target.value } } : b
                                        );
                                        setDesignerBlocks(newBlocks);
                                        setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, color: e.target.value } });
                                      }}
                                      placeholder="var(--color-bg-main)"
                                      style={{ flex: 1, padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                    />
                                  </div>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Alignment
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    {['left', 'center', 'right'].map(align => (
                                      <button
                                        key={align}
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, align } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, align } });
                                        }}
                                        style={{
                                          padding: '0.625rem',
                                          backgroundColor: selectedBlock.content.align === align ? primaryColor : 'var(--color-bg-paper)',
                                          border: selectedBlock.content.align === align ? `1px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                                          borderRadius: '0.375rem',
                                          color: 'var(--color-text-primary)',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          textTransform: 'capitalize'
                                        }}
                                      >
                                        {align}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Button Block Settings */}
                            {selectedBlock.type === 'button' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Button Text
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedBlock.content.text ?? ''}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, text: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, text: e.target.value } });
                                    }}
                                    placeholder="Shop Now"
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  />
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Link URL
                                  </label>
                                  <input
                                    type="url"
                                    value={selectedBlock.content.url ?? ''}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, url: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, url: e.target.value } });
                                    }}
                                    placeholder="https://yoursite.com"
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  />
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Button Color
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    {[primaryColor, 'var(--color-error)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-secondary)', 'var(--color-secondary-light)'].map(color => (
                                      <button
                                        key={color}
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, bgColor: color } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, bgColor: color } });
                                        }}
                                        style={{
                                          height: '40px',
                                          backgroundColor: color,
                                          border: selectedBlock.content.bgColor === color ? '3px solid var(--color-text-primary)' : '1px solid var(--color-border-strong)',
                                          borderRadius: '0.375rem',
                                          cursor: 'pointer'
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                      type="color"
                                      value={(selectedBlock.content.bgColor !== '' && selectedBlock.content.bgColor != null) ? selectedBlock.content.bgColor : primaryColor}
                                      onChange={(e) => {
                                        const newBlocks = designerBlocks.map(b => 
                                          b.id === selectedBlock.id ? { ...b, content: { ...b.content, bgColor: e.target.value } } : b
                                        );
                                        setDesignerBlocks(newBlocks);
                                        setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, bgColor: e.target.value } });
                                      }}
                                      style={{ width: '60px', height: '40px', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Custom color</span>
                                  </div>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Text Color
                                  </label>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['var(--color-text-primary)', 'var(--color-bg-main)'].map(color => (
                                      <button
                                        key={color}
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, textColor: color } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, textColor: color } });
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: '0.625rem',
                                          backgroundColor: color,
                                          border: selectedBlock.content.textColor === color ? `2px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                                          borderRadius: '0.375rem',
                                          color: color === 'var(--color-text-primary)' ? 'var(--color-bg-main)' : 'var(--color-text-primary)',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem'
                                        }}
                                      >
                                        {color === 'var(--color-text-primary)' ? 'White' : 'Black'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Image Block Settings */}
                            {selectedBlock.type === 'image' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                                    Select Image
                                  </label>
                                  {selectedBlock.content.imageUrl ? (
                                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                      <img src={selectedBlock.content.imageUrl} alt="Preview" style={{ width: '100%', height: 'auto', borderRadius: '6px' }} />
                                      <button
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, imageUrl: '' } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, imageUrl: '' } });
                                        }}
                                        style={{ position: 'absolute', top: '6px', right: '6px', padding: '4px 8px', backgroundColor: 'var(--color-error)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : null}
                                  <button
                                    onClick={() => setShowAssetLibrary(true)}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px dashed var(--color-text-disabled)', borderRadius: '0.5rem', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}
                                  >
                                    📁 Choose from Library
                                  </button>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Image Width
                                  </label>
                                  <select
                                    value={(selectedBlock.content.width !== '' && selectedBlock.content.width != null) ? selectedBlock.content.width : '100%'}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, width: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, width: e.target.value } });
                                    }}
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  >
                                    <option value="100%">Full Width</option>
                                    <option value="75%">75%</option>
                                    <option value="50%">50%</option>
                                    <option value="300px">300px</option>
                                    <option value="400px">400px</option>
                                  </select>
                                </div>
                                
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Link URL (optional)
                                  </label>
                                  <input
                                    type="url"
                                    value={selectedBlock.content.linkUrl ?? ''}
                                    onChange={(e) => {
                                      const newBlocks = designerBlocks.map(b => 
                                        b.id === selectedBlock.id ? { ...b, content: { ...b.content, linkUrl: e.target.value } } : b
                                      );
                                      setDesignerBlocks(newBlocks);
                                      setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, linkUrl: e.target.value } });
                                    }}
                                    placeholder="https://yoursite.com"
                                    style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Product Grid Settings */}
                            {selectedBlock.type === 'productGrid' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                    Number of Columns
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                                    {[2, 3, 4].map(cols => (
                                      <button
                                        key={cols}
                                        onClick={() => {
                                          const newBlocks = designerBlocks.map(b => 
                                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, columns: cols } } : b
                                          );
                                          setDesignerBlocks(newBlocks);
                                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, columns: cols } });
                                        }}
                                        style={{
                                          padding: '0.75rem',
                                          backgroundColor: selectedBlock.content.columns === cols ? primaryColor : 'var(--color-bg-paper)',
                                          border: selectedBlock.content.columns === cols ? `1px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                                          borderRadius: '0.375rem',
                                          color: 'var(--color-text-primary)',
                                          cursor: 'pointer',
                                          fontSize: '0.875rem',
                                          fontWeight: '600'
                                        }}
                                      >
                                        {cols}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedBlock.content.showPrice}
                                      onChange={(e) => {
                                        const newBlocks = designerBlocks.map(b => 
                                          b.id === selectedBlock.id ? { ...b, content: { ...b.content, showPrice: e.target.checked } } : b
                                        );
                                        setDesignerBlocks(newBlocks);
                                        setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, showPrice: e.target.checked } });
                                      }}
                                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Show Prices</span>
                                  </label>
                                  
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedBlock.content.showButton}
                                      onChange={(e) => {
                                        const newBlocks = designerBlocks.map(b => 
                                          b.id === selectedBlock.id ? { ...b, content: { ...b.content, showButton: e.target.checked } } : b
                                        );
                                        setDesignerBlocks(newBlocks);
                                        setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, showButton: e.target.checked } });
                                      }}
                                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Show &quot;Shop Now&quot; Buttons</span>
                                  </label>
                                </div>
                              </div>
                            )}

                            {/* Spacer Settings */}
                            {selectedBlock.type === 'spacer' && (
                              <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                                  Space Height
                                </label>
                                <select
                                  value={(selectedBlock.content.height !== '' && selectedBlock.content.height != null) ? selectedBlock.content.height : '40px'}
                                  onChange={(e) => {
                                    const newBlocks = designerBlocks.map(b => 
                                      b.id === selectedBlock.id ? { ...b, content: { ...b.content, height: e.target.value } } : b
                                    );
                                    setDesignerBlocks(newBlocks);
                                    setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, height: e.target.value } });
                                  }}
                                  style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                                >
                                  <option value="20px">Small (20px)</option>
                                  <option value="40px">Medium (40px)</option>
                                  <option value="60px">Large (60px)</option>
                                  <option value="80px">Extra Large (80px)</option>
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* No Block Selected */
                          <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--color-text-disabled)' }}>
                              <div>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
                                <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Click any block on the canvas</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-border-main)' }}>to edit its settings</p>
                              </div>
                            </div>
                            
                            <div style={{ borderTop: '1px solid var(--color-border-strong)', paddingTop: '1.5rem' }}>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase' }}>Advanced Options</h4>
                              
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                                  Import HTML
                                </label>
                                <input
                                  type="file"
                                  accept=".html,.htm"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        const html = event.target?.result as string;
                                        const newBlock = {
                                          id: `block_${Date.now()}`,
                                          type: 'html' as const,
                                          content: { html }
                                        };
                                        setDesignerBlocks([...designerBlocks, newBlock as DesignerBlock]);
                                      };
                                      reader.readAsText(file);
                                    }
                                  }}
                                  style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}
                                />
                              </div>

                              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                                💡 Design in Mailchimp, Canva, or any tool, then import the HTML here
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SMS Messages Tab */}
            {activeTab === 'sms' && (
              <div style={{ display: 'flex', gap: '2rem' }}>
                {/* SMS Template List */}
                <div style={{ width: '320px' }}>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>📱 About SMS Messages</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                      Create automated text messages for customer updates, reminders, and notifications. Messages are sent via Twilio.
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Predefined Triggers</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { id: 'order_confirmation', name: 'Order Confirmation', icon: '✅', description: 'Sent when order is placed' },
                        { id: 'order_shipped', name: 'Order Shipped', icon: '📦', description: 'Sent when order ships' },
                        { id: 'appointment_reminder', name: 'Appointment Reminder', icon: '📅', description: '24hrs before appointment' },
                        { id: 'appointment_confirmed', name: 'Appointment Confirmed', icon: '✓', description: 'When appointment booked' },
                        { id: 'payment_received', name: 'Payment Received', icon: '💳', description: 'When payment processed' },
                        { id: 'payment_due', name: 'Payment Reminder', icon: '⏰', description: 'Before payment due date' },
                        { id: 'service_complete', name: 'Service Completed', icon: '✨', description: 'After service finished' },
                        { id: 'delivery_arrived', name: 'Delivery Notification', icon: '🚚', description: 'When delivery arrives' }
                      ].map(trigger => (
                        <button
                          key={trigger.id}
                          onClick={() => {
                            setSelectedSmsTemplate(trigger.id);
                            setSmsContent(smsTemplates.find(t => t.id === trigger.id)?.message ?? '');
                          }}
                          style={{
                            padding: '1rem',
                            backgroundColor: selectedSmsTemplate === trigger.id ? 'var(--color-bg-elevated)' : 'transparent',
                            border: selectedSmsTemplate === trigger.id ? `1px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{trigger.icon}</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{trigger.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', paddingLeft: '2rem' }}>{trigger.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Custom Triggers</h3>
                      <button
                        onClick={() => setShowSmsCustomTrigger(true)}
                        style={{ padding: '0.375rem 0.75rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                      >
                        + New
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {smsTemplates.filter(t => t.isCustom).map(template => (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedSmsTemplate(template.id);
                            setSmsContent(template.message);
                          }}
                          style={{
                            padding: '1rem',
                            backgroundColor: selectedSmsTemplate === template.id ? 'var(--color-bg-elevated)' : 'transparent',
                            border: selectedSmsTemplate === template.id ? `1px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>🎯</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{template.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', paddingLeft: '2rem' }}>{template.trigger}</div>
                        </button>
                      ))}
                      
                      {smsTemplates.filter(t => t.isCustom).length === 0 && (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.75rem', border: '1px dashed var(--color-border-strong)', borderRadius: '0.5rem' }}>
                          No custom triggers yet.<br/>Click &quot;+ New&quot; to create one
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SMS Message Editor */}
                <div style={{ flex: 1 }}>
                  {selectedSmsTemplate ? (
                    <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                        {(() => { const name = smsTemplates.find(t => t.id === selectedSmsTemplate)?.name; return (name !== '' && name != null) ? name : 'SMS Template'; })()}
                      </h2>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                          Message Content
                        </label>
                        <textarea
                          value={smsContent}
                          onChange={(e) => {
                            if (e.target.value.length <= 160) {
                              setSmsContent(e.target.value);
                            }
                          }}
                          rows={6}
                          placeholder="Hi {{customer_name}}, your order #{{order_number}} has been confirmed!"
                          style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: smsContent.length > 140 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                            {smsContent.length}/160 characters {smsContent.length > 160 && '(1 extra SMS)'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                            {Math.ceil(smsContent.length / 160)} SMS {smsContent.length > 160 ? 'messages' : 'message'}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Available Variables:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                          <button
                            onClick={() => setSmsContent(`${smsContent  }{{customer_name}}`)}
                            style={{ padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.25rem', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            + {`{{customer_name}}`}
                          </button>
                          <button
                            onClick={() => setSmsContent(`${smsContent  }{{order_number}}`)}
                            style={{ padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.25rem', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            + {`{{order_number}}`}
                          </button>
                          <button
                            onClick={() => setSmsContent(`${smsContent  }{{appointment_date}}`)}
                            style={{ padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.25rem', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            + {`{{appointment_date}}`}
                          </button>
                          <button
                            onClick={() => setSmsContent(`${smsContent  }{{company_name}}`)}
                            style={{ padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.25rem', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            + {`{{company_name}}`}
                          </button>
                          <button
                            onClick={() => setSmsContent(`${smsContent  }{{tracking_link}}`)}
                            style={{ padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.25rem', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            + {`{{tracking_link}}`}
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-success-light)', lineHeight: '1.5' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>📱 SMS Best Practices:</strong>
                          • Keep messages under 160 characters to avoid extra charges<br/>
                          • Always include your business name<br/>
                          • Add opt-out option: &quot;Reply STOP to unsubscribe&quot;<br/>
                          • Personalize with customer name when possible
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button 
                          onClick={() => alert('Test SMS would be sent to your phone number')}
                          style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                        >
                          📤 Send Test SMS
                        </button>
                        <button 
                          onClick={() => {
                            const updated = smsTemplates.map(t => 
                              t.id === selectedSmsTemplate ? { ...t, message: smsContent } : t
                            );
                            if (!smsTemplates.find(t => t.id === selectedSmsTemplate)) {
                              updated.push({ 
                                id: selectedSmsTemplate, 
                                name: selectedSmsTemplate, 
                                message: smsContent,
                                trigger: selectedSmsTemplate,
                                isCustom: true
                              });
                            }
                            setSmsTemplates(updated);
                            alert('✅ SMS template saved!');
                          }}
                          style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                        >
                          💾 Save Template
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px dashed var(--color-border-strong)', borderRadius: '1rem', padding: '4rem 2rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📱</div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Select an SMS Template</h3>
                      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Choose a predefined trigger or create a custom one to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
              <div>
                {/* Campaign Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Total Campaigns</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>4</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Avg Open Rate</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: primaryColor }}>49.9%</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Avg Click Rate</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success-light)' }}>12.5%</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Total Sent</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>7,465</div>
                  </div>
                </div>

                {/* Campaigns List */}
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border-strong)' }}>
                          <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Campaign</th>
                          <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Status</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Recipients</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Opens</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Clicks</th>
                          <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(campaign => {
                          const openRate = campaign.opened && campaign.recipients ? ((campaign.opened / campaign.recipients) * 100).toFixed(1) : '-';
                          const clickRate = campaign.clicked && campaign.recipients ? ((campaign.clicked / campaign.recipients) * 100).toFixed(1) : '-';
                          
                          return (
                            <tr key={campaign.id} style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                              <td style={{ padding: '1rem 0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{campaign.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{campaign.subject}</div>
                              </td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.75rem',
                                  backgroundColor: 
                                    campaign.status === 'sent' ? 'var(--color-success-dark)' :
                                    campaign.status === 'scheduled' ? 'var(--color-warning-dark)' :
                                    campaign.status === 'sending' ? 'var(--color-info-dark)' :
                                    'var(--color-text-disabled)',
                                  color:
                                    campaign.status === 'sent' ? 'var(--color-success-light)' :
                                    campaign.status === 'scheduled' ? 'var(--color-warning-light)' :
                                    campaign.status === 'sending' ? 'var(--color-info-light)' :
                                    'var(--color-text-secondary)',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  textTransform: 'capitalize'
                                }}>
                                  {campaign.status}
                                </span>
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', textAlign: 'right', fontWeight: '600' }}>
                                {campaign.status === 'sending' ? `${campaign.sent}/${campaign.recipients}` : campaign.recipients.toLocaleString()}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', textAlign: 'right' }}>
                                {campaign.opened ? `${campaign.opened.toLocaleString()} (${openRate}%)` : '-'}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', textAlign: 'right' }}>
                                {campaign.clicked ? `${campaign.clicked.toLocaleString()} (${clickRate}%)` : '-'}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                {(campaign.sentDate !== '' && campaign.sentDate != null) ? campaign.sentDate : ((campaign.scheduledDate !== '' && campaign.scheduledDate != null) ? campaign.scheduledDate : 'Draft')}
                              </td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                    View
                                  </button>
                                  {campaign.status === 'draft' && (
                                    <button style={{ padding: '0.5rem 1rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
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

        {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Create Email Campaign</h2>
            
            {/* Campaign Name */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Holiday Sale 2025"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              />
            </div>

            {/* Template Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Email Template (Optional)
              </label>
              <select
                value={newCampaign.templateId}
                onChange={(e) => {
                  const templateId = e.target.value;
                  setNewCampaign({ ...newCampaign, templateId });
                  
                  // Load template content if custom template selected
                  if (templateId) {
                    const customTemplate = customTemplates.find(t => t.id === templateId);
                    if (customTemplate?.html) {
                      setNewCampaign({
                        ...newCampaign,
                        templateId,
                        subject: customTemplate.name,
                        body: customTemplate.html
                      });
                    }
                  }
                }}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              >
                <option value="">Create from scratch</option>
                <optgroup label="Custom Templates">
                  {customTemplates.map(template => (
                    <option key={template.id} value={template.id}>🎨 {template.name}</option>
                  ))}
                </optgroup>
                {customTemplates.length === 0 && (
                  <option disabled style={{ color: 'var(--color-text-disabled)' }}>No custom templates yet - create one in the Custom Templates tab</option>
                )}
              </select>
            </div>

            {/* Email Content */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Subject Line
              </label>
              <input
                type="text"
                value={newCampaign.subject}
                onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                placeholder="Special offer just for you, {{contact_name}}!"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Email Body
              </label>
              <textarea
                value={newCampaign.body}
                onChange={(e) => setNewCampaign({ ...newCampaign, body: e.target.value })}
                rows={10}
                placeholder="Hi {{contact_name}},&#10;&#10;We have an exclusive offer for you...&#10;&#10;Best regards,&#10;{{company_name}}"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>

            {/* Recipient Filters */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                  Target Audience (Filter Contacts)
                </label>
                {estimatedRecipients > 0 && (
                  <div style={{ fontSize: '0.875rem', color: primaryColor, fontWeight: '600' }}>
                    ~{estimatedRecipients.toLocaleString()} recipients
                  </div>
                )}
              </div>
              
              <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', padding: '1rem' }}>
                {campaignFilters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      No filters set - campaign will be sent to all contacts
                    </p>
                    <button
                      onClick={() => setShowFilterBuilder(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: primaryColor,
                        color: 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}
                    >
                      + Add Filter
                    </button>
                  </div>
                ) : (
                  <div>
                    {campaignFilters.map((filter, index) => (
                      <div 
                        key={filter.id || index}
                        style={{ 
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.375rem',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                            {filter.name || 'Filter'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {filter.groups.reduce((total, group) => total + group.conditions.length, 0)} condition(s)
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setCampaignFilters(filters => filters.filter((_, i) => i !== index));
                          }}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'transparent',
                            color: 'var(--color-error)',
                            border: '1px solid var(--color-error)',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setShowFilterBuilder(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: primaryColor,
                        border: `1px solid ${primaryColor}`,
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        marginTop: '0.5rem'
                      }}
                    >
                      + Add Another Filter
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--color-success-dark)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', fontSize: '0.75rem', color: 'var(--color-success-light)' }}>
                💡 Use filters to target specific segments: new contacts, high-value customers, inactive users, by location, tags, or any custom field
              </div>
            </div>

            {/* Send Options */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                Send Options
              </label>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setNewCampaign({ ...newCampaign, sendType: 'immediate' })}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: newCampaign.sendType === 'immediate' ? 'var(--color-bg-elevated)' : 'var(--color-bg-main)',
                    border: newCampaign.sendType === 'immediate' ? `2px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⚡ Send Immediately</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Send to all recipients right away</div>
                </button>
                
                <button
                  onClick={() => setNewCampaign({ ...newCampaign, sendType: 'scheduled' })}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: newCampaign.sendType === 'scheduled' ? 'var(--color-bg-elevated)' : 'var(--color-bg-main)',
                    border: newCampaign.sendType === 'scheduled' ? `2px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>📅 Schedule for Later</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Pick a specific date and time</div>
                </button>
              </div>

              {newCampaign.sendType === 'scheduled' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={newCampaign.scheduledDate}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduledDate: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={newCampaign.scheduledTime}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduledTime: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-strong)' }}>
              <button
                onClick={() => setShowCreateCampaign(false)}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Cancel
              </button>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    alert('Campaign saved as draft!');
                    setShowCreateCampaign(false);
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                >
                  Save as Draft
                </button>
                
                <button
                  onClick={() => {
                    const action = newCampaign.sendType === 'immediate' ? 'sent' : 'scheduled';
                    alert(`Campaign ${action} to ${estimatedRecipients} recipients!`);
                    setShowCreateCampaign(false);
                    setNewCampaign({ name: '', subject: '', body: '', templateId: '', sendType: 'immediate', scheduledDate: '', scheduledTime: '' });
                    setCampaignFilters([]);
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                >
                  {newCampaign.sendType === 'immediate' ? '📤 Send Now' : '📅 Schedule Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom SMS Trigger Modal */}
      {showSmsCustomTrigger && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', width: '100%', maxWidth: '700px' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-strong)' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Create Custom SMS Trigger</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Define when this SMS should be automatically sent</p>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  Trigger Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., VIP Customer Welcome"
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  When should this trigger?
                </label>
                <select style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <option>When a record is created...</option>
                  <option>When a record is updated...</option>
                  <option>When a field changes...</option>
                  <option>On a specific date/time...</option>
                  <option>When a condition is met...</option>
                </select>

                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                    Conditions (optional)
                  </label>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select style={{ padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                        <option>Select field...</option>
                        <option>Customer Tier</option>
                        <option>Order Total</option>
                        <option>Status</option>
                        <option>Tags</option>
                      </select>
                      <select style={{ padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                        <option>equals</option>
                        <option>greater than</option>
                        <option>less than</option>
                        <option>contains</option>
                      </select>
                      <input type="text" placeholder="Value" style={{ padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }} />
                    </div>
                  </div>
                  
                  <button style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: primaryColor, border: `1px solid ${primaryColor}`, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                    + Add Condition
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  Timing
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', border: `2px solid ${primaryColor}`, borderRadius: '0.5rem', color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⚡ Send Immediately</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>When trigger fires</div>
                  </button>
                  <button style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⏱️ Delay</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Wait before sending</div>
                  </button>
                </div>
              </div>

              <div style={{ padding: '1rem', backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-error-light)', lineHeight: '1.5' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>⚠️ Important:</strong>
                  SMS messages require customer consent. Make sure you have permission to text your customers and include opt-out instructions.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-strong)' }}>
                <button
                  onClick={() => setShowSmsCustomTrigger(false)}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newTrigger = {
                      id: `custom_${Date.now()}`,
                      name: 'Custom SMS Trigger',
                      trigger: 'Custom condition',
                      isCustom: true,
                      message: ''
                    };
                    setSmsTemplates([...smsTemplates, newTrigger]);
                    setSelectedSmsTemplate(newTrigger.id);
                    setShowSmsCustomTrigger(false);
                    alert('✅ Custom trigger created! Now set up your message.');
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                >
                  Create Trigger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Library Modal */}
      {showAssetLibrary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', width: '100%', maxWidth: '900px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Asset Library</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Your uploaded images and assets</p>
              </div>
              <button
                onClick={() => setShowAssetLibrary(false)}
                style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Upload New */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-strong)' }}>
              <label style={{ display: 'block', padding: '2rem', backgroundColor: 'var(--color-bg-main)', border: '2px dashed var(--color-text-disabled)', borderRadius: '0.75rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    const newAssets = files.map(file => ({
                      id: `asset_${Date.now()}_${Math.random()}`,
                      name: file.name,
                      url: URL.createObjectURL(file),
                      type: 'image',
                      uploadedAt: new Date()
                    }));
                    setUploadedAssets([...uploadedAssets, ...newAssets]);
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Click to upload images</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>or drag and drop files here</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem' }}>Supports: JPG, PNG, GIF, WebP</div>
              </label>
            </div>

            {/* Assets Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {uploadedAssets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🖼️</div>
                  <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No assets uploaded yet</p>
                  <p style={{ fontSize: '0.875rem' }}>Upload your images, logos, and graphics to use in your emails</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                  {uploadedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        if (selectedBlock) {
                          const newBlocks = designerBlocks.map(b => 
                            b.id === selectedBlock.id ? { ...b, content: { ...b.content, imageUrl: asset.url } } : b
                          );
                          setDesignerBlocks(newBlocks);
                          setSelectedBlock({ ...selectedBlock, content: { ...selectedBlock.content, imageUrl: asset.url } });
                          setShowAssetLibrary(false);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-strong)',
                        transition: 'all 0.2s',
                        backgroundColor: 'var(--color-bg-main)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = primaryColor;
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{ aspectRatio: '1', overflow: 'hidden', backgroundColor: 'var(--color-bg-elevated)' }}>
                        <img 
                          src={asset.url} 
                          alt={asset.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-disabled)' }}>
                          {new Date(asset.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border-strong)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                {uploadedAssets.length > 0 ? `${uploadedAssets.length} asset${uploadedAssets.length !== 1 ? 's' : ''} in your library` : 'Upload images to get started'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Builder Modal */}
      {showFilterBuilder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '900px' }}>
            <FilterBuilder
              fields={contactFields}
              onApply={(filter: ViewFilter) => {
                setCampaignFilters([...campaignFilters, filter]);
                setShowFilterBuilder(false);
              }}
              onClose={() => setShowFilterBuilder(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

