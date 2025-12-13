'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { sendSMS } from '@/lib/sms/sms-service';

export default function SmsMessagesPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<string | null>(null);
  const [showCustomTrigger, setShowCustomTrigger] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSMSResult, setTestSMSResult] = useState<{ success: boolean; message?: string } | null>(null);

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
              href={`/workspace/${orgId}/settings`}
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
              <span style={{ fontSize: '1.25rem' }}>←</span>
              {sidebarOpen && <span>Back to Settings</span>}
            </Link>
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
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>📱 SMS Messages</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Create automated text messages for customer updates, reminders, and notifications
              </p>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              {/* SMS Template List */}
              <div style={{ width: '320px' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>📱 About SMS</div>
                  <div style={{ fontSize: '0.75rem', color: '#ccc', lineHeight: '1.5' }}>
                    Automated text messages are sent via Twilio. Each SMS costs ~$0.01. Messages over 160 characters count as multiple SMS.
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#999', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Predefined Triggers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {predefinedTriggers.map(trigger => (
                      <button
                        key={trigger.id}
                        onClick={() => {
                          setSelectedSmsTemplate(trigger.id);
                          setSmsContent(smsTemplates.find(t => t.id === trigger.id)?.message || '');
                        }}
                        style={{
                          padding: '1rem',
                          backgroundColor: selectedSmsTemplate === trigger.id ? '#222' : 'transparent',
                          border: selectedSmsTemplate === trigger.id ? `1px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>{trigger.icon}</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{trigger.name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#999', paddingLeft: '2rem' }}>{trigger.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>Custom Triggers</h3>
                    <button
                      onClick={() => setShowCustomTrigger(true)}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
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
                          backgroundColor: selectedSmsTemplate === template.id ? '#222' : 'transparent',
                          border: selectedSmsTemplate === template.id ? `1px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>🎯</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{template.name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#999', paddingLeft: '2rem' }}>{template.trigger}</div>
                      </button>
                    ))}
                    
                    {smsTemplates.filter(t => t.isCustom).length === 0 && (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#666', fontSize: '0.75rem', border: '1px dashed #333', borderRadius: '0.5rem' }}>
                        No custom triggers yet.<br/>Click "+ New" to create one
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SMS Message Editor */}
              <div style={{ flex: 1 }}>
                {selectedSmsTemplate ? (
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
                      {predefinedTriggers.find(t => t.id === selectedSmsTemplate)?.name || smsTemplates.find(t => t.id === selectedSmsTemplate)?.name || 'SMS Template'}
                    </h2>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Message Content
                      </label>
                      <textarea
                        value={smsContent}
                        onChange={(e) => {
                          setSmsContent(e.target.value);
                        }}
                        rows={6}
                        placeholder="Hi {{customer_name}}, your order #{{order_number}} has been confirmed!"
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: smsContent.length > 140 ? '#f59e0b' : '#999' }}>
                          {smsContent.length}/160 characters {smsContent.length > 160 && '⚠️ Will send as multiple SMS'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          {Math.ceil(smsContent.length / 160)} SMS {smsContent.length > 160 ? `($${(Math.ceil(smsContent.length / 160) * 0.01).toFixed(2)})` : '($0.01)'}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', marginBottom: '0.5rem' }}>Available Variables:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                        <button
                          onClick={() => setSmsContent(smsContent + '{{customer_name}}')}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.25rem', color: '#ccc', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          + {`{{customer_name}}`}
                        </button>
                        <button
                          onClick={() => setSmsContent(smsContent + '{{order_number}}')}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.25rem', color: '#ccc', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          + {`{{order_number}}`}
                        </button>
                        <button
                          onClick={() => setSmsContent(smsContent + '{{appointment_date}}')}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.25rem', color: '#ccc', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          + {`{{appointment_date}}`}
                        </button>
                        <button
                          onClick={() => setSmsContent(smsContent + '{{company_name}}')}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.25rem', color: '#ccc', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          + {`{{company_name}}`}
                        </button>
                        <button
                          onClick={() => setSmsContent(smsContent + '{{tracking_link}}')}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.25rem', color: '#ccc', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          + {`{{tracking_link}}`}
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: '1rem', backgroundColor: '#1a2e1a', border: '1px solid #2d4a2d', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#86efac', lineHeight: '1.5' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>📱 SMS Best Practices:</strong>
                        • Keep messages under 160 characters to avoid extra charges<br/>
                        • Always include your business name<br/>
                        • Add opt-out: "Reply STOP to unsubscribe"<br/>
                        • Personalize with customer name when possible<br/>
                        • Only text customers who opted in
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Test Phone Number
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="tel"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          placeholder="+1234567890"
                          style={{ flex: 1, padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                        />
                        <button
                          onClick={async () => {
                            if (!testPhoneNumber) {
                              alert('Please enter a test phone number');
                              return;
                            }
                            setIsSendingTest(true);
                            setTestSMSResult(null);
                            try {
                              const result = await sendSMS({
                                to: testPhoneNumber,
                                message: smsContent || 'Test SMS message',
                                organizationId: 'demo-org',
                              });

                              if (result.success) {
                                setTestSMSResult({ success: true, message: `Test SMS sent! Message ID: ${result.messageId}` });
                                setTestPhoneNumber('');
                              } else {
                                setTestSMSResult({ success: false, message: result.error || 'Failed to send SMS' });
                              }
                            } catch (error: any) {
                              setTestSMSResult({ success: false, message: error.message || 'Failed to send SMS' });
                            } finally {
                              setIsSendingTest(false);
                            }
                          }}
                          disabled={isSendingTest || !testPhoneNumber || !smsContent}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: isSendingTest || !testPhoneNumber || !smsContent ? '#444' : '#222',
                            color: '#fff',
                            border: '1px solid #333',
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
                          backgroundColor: testSMSResult.success ? '#0f4c0f' : '#4c0f0f',
                          border: `1px solid ${testSMSResult.success ? '#4ade80' : '#f87171'}`,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          color: testSMSResult.success ? '#4ade80' : '#f87171'
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
                          alert('✅ SMS template saved! Now available in workflows and automations.');
                        }}
                        style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                      >
                        💾 Save Template
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px dashed #333', borderRadius: '1rem', padding: '4rem 2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📱</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Select an SMS Template</h3>
                    <p style={{ color: '#999', marginBottom: '1rem' }}>Choose a predefined trigger or create a custom one to get started</p>
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#1a2e2e', border: '1px solid #2d4a4a', borderRadius: '0.5rem', maxWidth: '500px', margin: '2rem auto 0', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.875rem', color: '#86efef', lineHeight: '1.5' }}>
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
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', width: '100%', maxWidth: '700px' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Create Custom SMS Trigger</h2>
              <p style={{ fontSize: '0.875rem', color: '#999' }}>Define when this SMS should be automatically sent</p>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                  Trigger Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., VIP Customer Welcome"
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                  When should this trigger?
                </label>
                <select style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <option>When a record is created...</option>
                  <option>When a record is updated...</option>
                  <option>When a field changes...</option>
                  <option>On a specific date/time...</option>
                  <option>When a condition is met...</option>
                </select>

                <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.75rem' }}>
                    Conditions (optional)
                  </label>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select style={{ padding: '0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.375rem', color: '#fff', fontSize: '0.875rem' }}>
                        <option>Select field...</option>
                        <option>Customer Tier</option>
                        <option>Order Total</option>
                        <option>Status</option>
                        <option>Tags</option>
                      </select>
                      <select style={{ padding: '0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.375rem', color: '#fff', fontSize: '0.875rem' }}>
                        <option>equals</option>
                        <option>greater than</option>
                        <option>less than</option>
                        <option>contains</option>
                      </select>
                      <input type="text" placeholder="Value" style={{ padding: '0.625rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.375rem', color: '#fff', fontSize: '0.875rem' }} />
                    </div>
                  </div>
                  
                  <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: primaryColor, border: `1px solid ${primaryColor}`, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                    + Add Condition
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                  Timing
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button style={{ padding: '1rem', backgroundColor: '#222', border: `2px solid ${primaryColor}`, borderRadius: '0.5rem', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⚡ Send Immediately</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>When trigger fires</div>
                  </button>
                  <button style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>⏱️ Delay</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>Wait before sending</div>
                  </button>
                </div>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#2e1a1a', border: '1px solid #4a2d2d', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', lineHeight: '1.5' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>⚠️ Important:</strong>
                  SMS messages require customer consent. Make sure you have permission to text your customers and include opt-out instructions like "Reply STOP to unsubscribe".
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #333' }}>
                <button
                  onClick={() => setShowCustomTrigger(false)}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
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
                    setShowCustomTrigger(false);
                    alert('✅ Custom trigger created! Now set up your message.');
                  }}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
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

