'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import AdminBar from '@/components/AdminBar'
import { logger } from '@/lib/logger/logger';;

interface APIKey {
  service: string;
  key: string;
  configured: boolean;
  required: boolean;
}

export default function APIKeysPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const response = await fetch(`/api/settings/api-keys?orgId=${orgId}`);
      const data = await response.json();
      if (data.success) {
        setKeys(data.keys || {});
      }
    } catch (error) {
      logger.error('Failed to load API keys:', error, { file: 'page.tsx' });
    }
  };

  const saveKey = async (service: string, value: string) => {
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, service, key: value }),
      });

      const data = await response.json();
      if (data.success) {
        setKeys({ ...keys, [service]: value });
        alert('API key saved successfully!');
      } else {
        alert(`Failed to save: ${  data.error}`);
      }
    } catch (error) {
      alert('Error saving API key');
    }
  };

  const testKey = async (service: string) => {
    setTesting(service);
    try {
      const response = await fetch(`/api/settings/api-keys/test?orgId=${orgId}&service=${service}`);
      const data = await response.json();
      
      setTestResults({ ...testResults, [service]: data });
      
      if (data.success) {
        alert(`✅ ${  service  } is working!`);
      } else {
        alert(`❌ ${  service  } test failed: ${  data.error}`);
      }
    } catch (error) {
      alert('Error testing API key');
    } finally {
      setTesting(null);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const services = [
    {
      id: 'openrouter',
      name: '⭐ OpenRouter (RECOMMENDED)',
      icon: '🌟',
      description: 'ONE KEY FOR EVERYTHING - Access GPT-4, Claude, Gemini, Llama, and 100+ AI models',
      required: false,
      placeholder: 'sk-or-v1-...',
      setupUrl: 'https://openrouter.ai',
      setupSteps: [
        'Go to openrouter.ai',
        'Sign up with Google/GitHub (takes 30 seconds)',
        'Click "Keys" in top menu',
        'Create a new key',
        'Copy and paste here',
        'Done! Now you have access to 100+ AI models',
      ],
      cost: 'Usually 20-30% cheaper than OpenAI direct',
      why: '🌟 RECOMMENDED FOR SIMPLICITY: Instead of managing 3+ different API keys (OpenAI, Anthropic, Google), you get ONE key that works with everything. Simpler setup, lower cost, better reliability. This is what we use ourselves!',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      icon: '🤖',
      description: 'Direct OpenAI access for GPT-4 and other models',
      required: false,
      placeholder: 'sk-...',
      setupUrl: 'https://platform.openai.com/api-keys',
      setupSteps: [
        'Go to platform.openai.com',
        'Sign up or log in',
        'Click "API Keys" in left menu',
        'Click "Create new secret key"',
        'Copy the key and paste here',
      ],
      cost: '$10-50/month depending on usage',
      why: 'Needed for: AI email writer, reply handler, chat agent. Note: OpenRouter is usually cheaper and gives access to more models.',
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      icon: '🧠',
      description: 'Direct Anthropic access for Claude models',
      required: false,
      placeholder: 'sk-ant-...',
      setupUrl: 'https://console.anthropic.com',
      setupSteps: [
        'Go to console.anthropic.com',
        'Create account',
        'API Keys → Create Key',
        'Copy and paste here',
      ],
      cost: 'Pay-as-you-go',
      why: 'For direct access to Claude 3 Opus, Sonnet, and Haiku. Note: OpenRouter also provides Claude access.',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      icon: '✨',
      description: 'Google AI for Gemini models',
      required: false,
      placeholder: 'AIza...',
      setupUrl: 'https://aistudio.google.com',
      setupSteps: [
        'Go to aistudio.google.com',
        'Get API Key',
        'Copy and paste here',
      ],
      cost: 'FREE tier available',
      why: 'For Google Gemini Pro and Ultra. Note: OpenRouter also provides Gemini access.',
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      icon: '📧',
      description: 'Email delivery service (required for sending emails)',
      required: true,
      placeholder: 'SG....',
      setupUrl: 'https://sendgrid.com',
      setupSteps: [
        'Go to sendgrid.com and sign up',
        'Verify your sender email address',
        'Settings → API Keys → Create API Key',
        'Choose "Full Access"',
        'Copy the key and paste here',
      ],
      cost: 'FREE: 100 emails/day, $20/month: 40K emails',
      why: 'Needed for: Email sequences, outbound campaigns. You can\'t send emails from your server directly - they\'ll be marked as spam. SendGrid is the "post office" that actually delivers emails.',
    },
    {
      id: 'resend',
      name: 'Resend',
      icon: '📨',
      description: 'Modern email API (alternative to SendGrid)',
      required: false,
      placeholder: 're_...',
      setupUrl: 'https://resend.com',
      setupSteps: [
        'Go to resend.com',
        'Sign up',
        'API Keys → Create',
        'Copy and paste here',
      ],
      cost: 'FREE: 3K emails/month',
      why: 'Alternative to SendGrid. Simpler, modern API. Great for transactional emails.',
    },
    {
      id: 'google_client_id',
      name: 'Google Client ID',
      icon: '📅',
      description: 'Allows users to connect their Google Calendar & Gmail',
      required: false,
      placeholder: '....apps.googleusercontent.com',
      setupUrl: 'https://console.cloud.google.com',
      setupSteps: [
        'Go to console.cloud.google.com',
        'Create new project (name it anything)',
        'Enable "Google Calendar API" and "Gmail API"',
        'Credentials → Create Credentials → OAuth client ID',
        'Application type: Web application',
        'Authorized redirect URI: http://localhost:3000/api/integrations/google/callback',
        'Copy the Client ID and paste here',
      ],
      cost: 'FREE (Google gives this away)',
      why: 'Needed for: Meeting scheduler, Gmail sync. This lets users connect THEIR Gmail/Calendar to the app.',
    },
    {
      id: 'google_client_secret',
      name: 'Google Client Secret',
      icon: '🔐',
      description: 'Goes with Google Client ID (you get both at the same time)',
      required: false,
      placeholder: 'GOCSPX-...',
      setupUrl: 'https://console.cloud.google.com',
      setupSteps: [
        'Same place you got Client ID',
        'Copy the Client Secret and paste here',
      ],
      cost: 'FREE',
      why: 'Needed for: Same as Client ID. These are a pair.',
    },
    {
      id: 'stripe_publishable',
      name: 'Stripe Publishable Key',
      icon: '💳',
      description: 'Processes payments for e-commerce',
      required: false,
      placeholder: 'pk_test_...',
      setupUrl: 'https://dashboard.stripe.com',
      setupSteps: [
        'Go to dashboard.stripe.com and sign up',
        'Developers → API keys',
        'Copy "Publishable key" and paste here',
      ],
      cost: 'FREE (Stripe takes 2.9% + 30¢ per transaction)',
      why: 'Needed for: E-commerce payments. If you\'re not selling products, you don\'t need this.',
    },
    {
      id: 'stripe_secret',
      name: 'Stripe Secret Key',
      icon: '🔑',
      description: 'Goes with Stripe Publishable Key',
      required: false,
      placeholder: 'sk_test_...',
      setupUrl: 'https://dashboard.stripe.com',
      setupSteps: [
        'Same place as Publishable key',
        'Copy "Secret key" and paste here',
        'NEVER share this publicly!',
      ],
      cost: 'FREE',
      why: 'Needed for: Same as Publishable key. These are a pair.',
    },
    {
      id: 'paypal_client_id',
      name: 'PayPal Client ID',
      icon: '💳',
      description: 'PayPal payment processing',
      required: false,
      placeholder: 'A...',
      setupUrl: 'https://developer.paypal.com',
      setupSteps: [
        'Go to developer.paypal.com',
        'My Apps & Credentials',
        'Create App',
        'Copy Client ID',
      ],
      cost: 'Transaction fees apply',
      why: 'Alternative to Stripe for payments.',
    },
    {
      id: 'twilio_account_sid',
      name: 'Twilio Account SID',
      icon: '📱',
      description: 'SMS messaging service',
      required: false,
      placeholder: 'AC...',
      setupUrl: 'https://www.twilio.com',
      setupSteps: [
        'Go to twilio.com/console',
        'Find Account SID',
        'Copy and paste here',
      ],
      cost: '$0.0079 per SMS',
      why: 'For sending SMS messages to leads/customers.',
    },
    {
      id: 'twilio_auth_token',
      name: 'Twilio Auth Token',
      icon: '🔐',
      description: 'Goes with Twilio Account SID',
      required: false,
      placeholder: '...',
      setupUrl: 'https://www.twilio.com',
      setupSteps: [
        'Same place as Account SID',
        'Copy Auth Token',
      ],
      cost: 'FREE',
      why: 'Needed with Account SID.',
    },
    {
      id: 'slack_webhook',
      name: 'Slack Webhook URL',
      icon: '💬',
      description: 'Send notifications to Slack',
      required: false,
      placeholder: 'https://hooks.slack.com/...',
      setupUrl: 'https://api.slack.com',
      setupSteps: [
        'Go to api.slack.com/apps',
        'Create New App',
        'Incoming Webhooks → Activate',
        'Copy Webhook URL',
      ],
      cost: 'FREE',
      why: 'Get notified in Slack when deals close, leads come in, etc.',
    },
    {
      id: 'zapier_webhook',
      name: 'Zapier Webhook URL',
      icon: '⚡',
      description: 'Connect to 5000+ apps via Zapier',
      required: false,
      placeholder: 'https://hooks.zapier.com/...',
      setupUrl: 'https://zapier.com',
      setupSteps: [
        'Create Zap in Zapier',
        'Choose "Webhooks" trigger',
        'Copy webhook URL',
      ],
      cost: 'Zapier pricing applies',
      why: 'Integrate with any app Zapier supports.',
    },
    {
      id: 'clearbit_api_key',
      name: 'Clearbit',
      icon: '🔍',
      description: 'Company & contact data enrichment',
      required: false,
      placeholder: 'sk_...',
      setupUrl: 'https://clearbit.com',
      setupSteps: [
        'Sign up at clearbit.com',
        'Dashboard → API Keys',
        'Copy and paste here',
      ],
      cost: '$99/month+',
      why: 'Auto-enrich leads with company data, employee count, revenue, etc.',
    },
    {
      id: 'hubspot_api_key',
      name: 'HubSpot',
      icon: '🎯',
      description: 'HubSpot CRM integration',
      required: false,
      placeholder: 'pat-...',
      setupUrl: 'https://app.hubspot.com',
      setupSteps: [
        'Settings → Integrations → Private Apps',
        'Create private app',
        'Copy access token',
      ],
      cost: 'FREE (HubSpot account required)',
      why: 'Sync data with HubSpot CRM.',
    },
  ];

  // Custom API Keys state
  const [customKeys, setCustomKeys] = useState<Array<{id: string, name: string, key: string}>>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomKey, setNewCustomKey] = useState({name: '', key: ''});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />
      
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Settings
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              API Keys Setup
            </h1>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Connect external services to enable features. Add keys here instead of messing with .env files.
            </p>
          </div>

          {/* OpenRouter Recommendation Banner */}
          <div style={{ backgroundColor: '#1a3a1a', border: '2px solid #10b981', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⭐ We Recommend: OpenRouter
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#d1d5db', lineHeight: '1.7' }}>
              <p style={{ marginBottom: '0.75rem', fontWeight: '500', color: '#fff' }}>
                For maximum simplicity and best value, use <strong style={{ color: '#10b981' }}>OpenRouter</strong> as your AI provider.
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>Why we recommend it:</strong>
              </p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem', color: '#d1d5db' }}>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>One key</strong> gives you access to 100+ AI models (GPT-4, Claude, Gemini, Llama, and more)</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Simpler setup</strong> - No need to manage multiple API keys from different providers</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Usually cheaper</strong> - Often 20-30% less expensive than going direct to OpenAI</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Better reliability</strong> - Automatic failover if one provider has issues</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Easy switching</strong> - Try different models without getting new API keys</li>
              </ul>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '1rem' }}>
                📝 Get your OpenRouter key at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>openrouter.ai</a> (takes 2 minutes)
              </p>
            </div>
          </div>

          {/* What You Need Banner */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
              ⚡ What You Need to Get Started
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: '#10b981' }}>REQUIRED (AI features won't work without these):</strong>
              </p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
                <li>OpenAI API Key - Powers all AI features ($10-50/month)</li>
                <li>SendGrid API Key - Actually sends emails ($20/month)</li>
              </ul>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: '#f59e0b' }}>OPTIONAL (but highly recommended):</strong>
              </p>
              <ul style={{ marginLeft: '1.5rem' }}>
                <li>Google OAuth - For calendar & Gmail (FREE)</li>
                <li>Stripe - For payments (FREE, only pay per transaction)</li>
              </ul>
            </div>
          </div>

          {/* API Keys */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {services.map((service) => (
              <div
                key={service.id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '1rem',
                  padding: '2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>{service.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>
                        {service.name}
                      </h3>
                      {service.required && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#10b981',
                          color: '#000',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: '700',
                        }}>
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.75rem' }}>
                      {service.description}
                    </p>
                    
                    {/* Why do I need this? */}
                    <details style={{ marginBottom: '1rem' }}>
                      <summary style={{ fontSize: '0.75rem', color: primaryColor, cursor: 'pointer', marginBottom: '0.5rem' }}>
                        Why do I need this? • Cost: {service.cost}
                      </summary>
                      <div style={{ fontSize: '0.75rem', color: '#999', backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                        <p style={{ marginBottom: '0.5rem' }}><strong>What it does:</strong> {service.why}</p>
                        <p><strong>Cost:</strong> {service.cost}</p>
                      </div>
                    </details>

                    {/* Setup Instructions */}
                    <details style={{ marginBottom: '1rem' }}>
                      <summary style={{ fontSize: '0.75rem', color: primaryColor, cursor: 'pointer', marginBottom: '0.5rem' }}>
                        📖 Show setup instructions
                      </summary>
                      <div style={{ fontSize: '0.75rem', color: '#999', backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                        <ol style={{ marginLeft: '1rem', lineHeight: '1.6' }}>
                          {service.setupSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                        <a
                          href={service.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: primaryColor, marginTop: '0.5rem', display: 'inline-block' }}
                        >
                          Open {service.name} →
                        </a>
                      </div>
                    </details>

                    {/* Input */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="password"
                        value={keys[service.id] || ''}
                        onChange={(e) => setKeys({ ...keys, [service.id]: e.target.value })}
                        placeholder={service.placeholder}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        onClick={() => saveKey(service.id, keys[service.id] || '')}
                        disabled={!keys[service.id]}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: keys[service.id] ? primaryColor : '#333',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: keys[service.id] ? 'pointer' : 'not-allowed',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => testKey(service.id)}
                        disabled={!keys[service.id] || testing === service.id}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: keys[service.id] && testing !== service.id ? 'pointer' : 'not-allowed',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        {testing === service.id ? 'Testing...' : 'Test'}
                      </button>
                    </div>

                    {/* Test Result */}
                    {testResults[service.id] && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: testResults[service.id].success ? '#064e3b' : '#7f1d1d',
                        border: `1px solid ${testResults[service.id].success ? '#10b981' : '#ef4444'}`,
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        color: testResults[service.id].success ? '#6ee7b7' : '#fecaca',
                      }}>
                        {testResults[service.id].success ? '✅ Working!' : `❌ ${  testResults[service.id].error}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
