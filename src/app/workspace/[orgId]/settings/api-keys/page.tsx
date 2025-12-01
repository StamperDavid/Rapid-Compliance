'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';

interface APIKey {
  service: string;
  key: string;
  configured: boolean;
  required: boolean;
}

export default function APIKeysPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [theme, setTheme] = useState<any>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
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
      console.error('Failed to load API keys:', error);
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
        alert('Failed to save: ' + data.error);
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
        alert('✅ ' + service + ' is working!');
      } else {
        alert('❌ ' + service + ' test failed: ' + data.error);
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
      id: 'openai',
      name: 'OpenAI',
      icon: '🤖',
      description: 'Powers AI email generation, reply handling, and chat agent',
      required: true,
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
      why: 'Needed for: AI email writer, reply handler, chat agent. Without this, AI features won\'t work.',
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      icon: '📧',
      description: 'Actually sends your outbound emails (without this, emails go to spam)',
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
      cost: '$20/month for 40,000 emails',
      why: 'Needed for: Email sequences, outbound campaigns. You can\'t send emails from your server directly - they\'ll be marked as spam. SendGrid is the "post office" that actually delivers emails.',
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
  ];

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
                        {testResults[service.id].success ? '✅ Working!' : '❌ ' + testResults[service.id].error}
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
