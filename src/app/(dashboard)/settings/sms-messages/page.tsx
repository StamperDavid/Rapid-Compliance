'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuth } from '@/hooks/useAuth';
import { sendSMS } from '@/lib/sms/sms-service';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';

interface SmsTemplate {
  id: string;
  name?: string;
  message: string;
  trigger?: string;
  isCustom?: boolean;
}

const smsTemplatesPath = getSubCollection('smsTemplates');

export default function SmsMessagesPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useOrgTheme();
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<string | null>(null);
  const [showCustomTrigger, setShowCustomTrigger] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSMSResult, setTestSMSResult] = useState<{ success: boolean; message?: string } | null>(null);
  const toast = useToast();

  // Load SMS templates from Firestore on mount
  const loadSmsTemplates = useCallback(async () => {
    try {
      const saved = await FirestoreService.getAll<SmsTemplate>(smsTemplatesPath);
      if (saved.length > 0) {
        setSmsTemplates(saved);
      }
    } catch {
      // Silent fail — templates just won't be pre-loaded
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadSmsTemplates();
    }
  }, [user, loadSmsTemplates]);

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const predefinedTriggers = [
    { id: 'order_confirmation', name: 'Order Confirmation', icon: '✅', description: 'Sent when order is placed' },
    { id: 'order_shipped', name: 'Order Shipped', icon: '📦', description: 'Sent when order ships' },
    { id: 'appointment_reminder', name: 'Appointment Reminder', icon: '📅', description: '24hrs before appointment' },
    { id: 'appointment_confirmed', name: 'Appointment Confirmed', icon: '✓', description: 'When appointment booked' },
    { id: 'payment_received', name: 'Payment Received', icon: '💳', description: 'When payment processed' },
    { id: 'payment_due', name: 'Payment Reminder', icon: '⏰', description: 'Before payment due date' },
    { id: 'service_complete', name: 'Service Completed', icon: '✨', description: 'After service finished' },
    { id: 'delivery_arrived', name: 'Delivery Notification', icon: '🚚', description: 'When delivery arrives' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: 'var(--color-bg-main)',
          borderRight: '1px solid var(--color-border-light)',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href={`/settings`}
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>←</span>
              {sidebarOpen && <span>Back to Settings</span>}
            </Link>
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-secondary)',
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
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>📱 SMS Messages</h1>
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                Create automated text messages for customer updates, reminders, and notifications
              </p>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              {/* SMS Template List */}
              <div style={{ width: '320px' }}>
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>📱 About SMS</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                    Automated text messages are sent via Twilio. Each SMS costs ~$0.01. Messages over 160 characters count as multiple SMS.
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Predefined Triggers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {predefinedTriggers.map(trigger => (
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
                      onClick={() => setShowCustomTrigger(true)}
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
                    {(() => {
                      const predefinedName = predefinedTriggers.find(t => t.id === selectedSmsTemplate)?.name;
                      const templateName = smsTemplates.find(t => t.id === selectedSmsTemplate)?.name;
                      return predefinedName ?? (templateName ?? 'SMS Template');
                    })()}
                  </h2>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Message Content
                      </label>
                      <textarea
                        value={smsContent}
                        onChange={(e) => {
                          setSmsContent(e.target.value);
                        }}
                        rows={6}
                        placeholder="Hi {{customer_name}}, your order #{{order_number}} has been confirmed!"
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: smsContent.length > 140 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                          {smsContent.length}/160 characters {smsContent.length > 160 && '⚠️ Will send as multiple SMS'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                          {Math.ceil(smsContent.length / 160)} SMS {smsContent.length > 160 ? `($${(Math.ceil(smsContent.length / 160) * 0.01).toFixed(2)})` : '($0.01)'}
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
                        • Add opt-out: &quot;Reply STOP to unsubscribe&quot;<br/>
                        • Personalize with customer name when possible<br/>
                        • Only text customers who opted in
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Test Phone Number
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="tel"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          placeholder="+1234567890"
                          style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                        />
                        <button
                          onClick={() => {
                            const sendTest = async () => {
                              if (!testPhoneNumber) {
                                toast.warning('Please enter a test phone number');
                                return;
                              }
                              setIsSendingTest(true);
                              setTestSMSResult(null);
                              try {
                                const result = await sendSMS({
                                  to: testPhoneNumber,
                                  message: smsContent || 'Test SMS message',
                                });

                                if (result.success) {
                                  setTestSMSResult({ success: true, message: `Test SMS sent! Message ID: ${result.messageId}` });
                                  setTestPhoneNumber('');
                                } else {
                                  setTestSMSResult({ success: false, message: (result.error !== '' && result.error != null) ? result.error : 'Failed to send SMS' });
                                }
                              } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
                                setTestSMSResult({ success: false, message: errorMessage });
                              } finally {
                                setIsSendingTest(false);
                              }
                            };
                            void sendTest();
                          }}
                          disabled={isSendingTest || !testPhoneNumber || !smsContent}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: isSendingTest || !testPhoneNumber || !smsContent ? 'var(--color-border-main)' : 'var(--color-bg-elevated)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            cursor: isSendingTest || !testPhoneNumber || !smsContent ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isSendingTest ? 'Sending...' : '📤 Send Test SMS'}
                        </button>
                      </div>
                      {testSMSResult && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: testSMSResult.success ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
                          border: `1px solid ${testSMSResult.success ? 'var(--color-success-light)' : 'var(--color-error-light)'}`,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          color: testSMSResult.success ? 'var(--color-success-light)' : 'var(--color-error-light)'
                        }}>
                          {testSMSResult.success ? '✓ ' : '✗ '}
                          {testSMSResult.message}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <button
                        onClick={() => {
                          const updated = smsTemplates.map(t =>
                            t.id === selectedSmsTemplate ? { ...t, message: smsContent } : t
                          );
                          if (!smsTemplates.find(t => t.id === selectedSmsTemplate)) {
                            updated.push({ id: selectedSmsTemplate, message: smsContent });
                          }
                          setSmsTemplates(updated);
                          // Persist to Firestore
                          const templateToSave = updated.find(t => t.id === selectedSmsTemplate);
                          if (templateToSave) {
                            void FirestoreService.set(smsTemplatesPath, templateToSave.id, templateToSave, true).catch(() => {
                              toast.error('Failed to persist SMS template');
                            });
                          }
                          toast.success('SMS template saved! Now available in workflows and automations.');
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
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--color-info-dark)', border: '1px solid var(--color-info-dark)', borderRadius: '0.5rem', maxWidth: '500px', margin: '2rem auto 0', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-info-light)', lineHeight: '1.5' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>💡 Getting Started:</strong>
                        1. Select a predefined trigger on the left<br/>
                        2. Or create a custom trigger for your specific needs<br/>
                        3. Write your message with variables<br/>
                        4. Save and use in automated workflows
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom SMS Trigger Modal */}
      {showCustomTrigger && (
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
                  SMS messages require customer consent. Make sure you have permission to text your customers and include opt-out instructions like &quot;Reply STOP to unsubscribe&quot;.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-strong)' }}>
                <button
                  onClick={() => setShowCustomTrigger(false)}
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
                    // Persist to Firestore
                    void FirestoreService.set(smsTemplatesPath, newTrigger.id, newTrigger, false).catch(() => {
                      toast.error('Failed to persist custom trigger');
                    });
                    setSelectedSmsTemplate(newTrigger.id);
                    setShowCustomTrigger(false);
                    toast.success('Custom trigger created! Now set up your message.');
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
    </div>
  );
}

