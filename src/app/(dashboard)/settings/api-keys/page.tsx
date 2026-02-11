'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

/** Get Authorization header with Firebase ID token */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getCurrentUser } = await import('@/lib/auth/auth-service');
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

interface APIKeyLoadResponse {
  success: boolean;
  keys?: Record<string, string>;
}

interface APIKeySaveResponse {
  success: boolean;
  error?: string;
}

interface APIKeyTestResponse {
  success: boolean;
  error?: string;
}

export default function APIKeysPage() {
  const { theme } = useOrgTheme();

  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, APIKeyTestResponse>>({});
  const [saveResults, setSaveResults] = useState<Record<string, 'success' | 'error'>>({});
  const toast = useToast();

  const loadKeys = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/settings/api-keys?PLATFORM_ID=${PLATFORM_ID}`, {
        headers: authHeaders,
      });
      const data = await response.json() as APIKeyLoadResponse;
      if (data.success) {
        setKeys(data.keys ?? {});
      }
    } catch (_error) {
      logger.error('Failed to load API keys:', _error instanceof Error ? _error : new Error(String(_error)), { file: 'page.tsx' });
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const saveKey = async (service: string, value: string) => {
    setSaving(service);
    setSaveResults(prev => { const next = { ...prev }; delete next[service]; return next; });
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ PLATFORM_ID, service, key: value }),
      });

      const data = await response.json() as APIKeySaveResponse;
      if (data.success) {
        setKeys({ ...keys, [service]: value });
        setSaveResults(prev => ({ ...prev, [service]: 'success' }));
        toast.success('API key saved successfully!');
      } else {
        setSaveResults(prev => ({ ...prev, [service]: 'error' }));
        toast.error(`Failed to save: ${data.error ?? 'Unknown error'}`);
      }
    } catch (_error) {
      setSaveResults(prev => ({ ...prev, [service]: 'error' }));
      toast.error('Error saving API key');
    } finally {
      setSaving(null);
    }
  };

  const deleteKey = async (service: string) => {
    setSaving(service);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ PLATFORM_ID, service }),
      });

      const data = await response.json() as APIKeySaveResponse;
      if (data.success) {
        setKeys(prev => { const next = { ...prev }; delete next[service]; return next; });
        setSaveResults(prev => { const next = { ...prev }; delete next[service]; return next; });
        toast.success(`${service} key removed`);
      } else {
        toast.error(`Failed to delete: ${data.error ?? 'Unknown error'}`);
      }
    } catch (_error) {
      toast.error('Error deleting API key');
    } finally {
      setSaving(null);
    }
  };

  const testKey = async (service: string) => {
    setTesting(service);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/settings/api-keys/test?PLATFORM_ID=${PLATFORM_ID}&service=${service}`, {
        headers: authHeaders,
      });
      const data = await response.json() as APIKeyTestResponse;

      setTestResults({ ...testResults, [service]: data });

      if (data.success) {
        toast.success(`${service} is working!`);
      } else {
        toast.error(`${service} test failed: ${data.error ?? 'Unknown error'}`);
      }
    } catch (_error) {
      toast.error('Error testing API key');
    } finally {
      setTesting(null);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

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
    {
      id: 'heygen',
      name: 'HeyGen',
      icon: '🎬',
      description: 'AI avatar video generation',
      required: false,
      placeholder: 'your-heygen-api-key',
      setupUrl: 'https://app.heygen.com',
      setupSteps: [
        'Go to app.heygen.com',
        'Sign up or log in',
        'Settings → API → Generate API Key',
        'Copy and paste here',
      ],
      cost: 'Plans start at $29/month',
      why: 'Create AI-generated video content with realistic avatars for outreach and marketing.',
    },
    {
      id: 'runway',
      name: 'Runway',
      icon: '🎥',
      description: 'AI video generation (Gen-3)',
      required: false,
      placeholder: 'your-runway-api-key',
      setupUrl: 'https://app.runwayml.com',
      setupSteps: [
        'Go to app.runwayml.com',
        'Sign up or log in',
        'Account → API Keys',
        'Copy and paste here',
      ],
      cost: 'Plans start at $12/month',
      why: 'Generate and edit video content using AI for marketing campaigns.',
    },
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      icon: '🔊',
      description: 'AI voice generation and text-to-speech',
      required: false,
      placeholder: 'your-elevenlabs-api-key',
      setupUrl: 'https://elevenlabs.io',
      setupSteps: [
        'Go to elevenlabs.io',
        'Sign up or log in',
        'Profile → API Key',
        'Copy and paste here',
      ],
      cost: 'FREE tier: 10K chars/month, $5/month: 30K chars',
      why: 'Generate realistic voice audio for voice AI agents, IVR, and audio content.',
    },
    {
      id: 'unreal_speech',
      name: 'Unreal Speech',
      icon: '🗣️',
      description: 'Low-cost text-to-speech API',
      required: false,
      placeholder: 'your-unrealspeech-api-key',
      setupUrl: 'https://unrealspeech.com',
      setupSteps: [
        'Go to unrealspeech.com',
        'Sign up',
        'Dashboard → API Key',
        'Copy and paste here',
      ],
      cost: 'FREE tier available, paid plans from $8/month',
      why: 'Budget-friendly alternative to ElevenLabs for voice generation.',
    },
    {
      id: 'serper',
      name: 'Serper',
      icon: '🔎',
      description: 'Google Search API for AI enrichment',
      required: false,
      placeholder: 'your-serper-api-key',
      setupUrl: 'https://serper.dev',
      setupSteps: [
        'Go to serper.dev',
        'Sign up',
        'Dashboard → API Key',
        'Copy and paste here',
      ],
      cost: 'FREE: 2,500 queries, then $50/month for 50K',
      why: 'Powers AI-driven prospect research and lead enrichment via Google Search results.',
    },
    {
      id: 'newsapi',
      name: 'NewsAPI',
      icon: '📰',
      description: 'News data for prospect research',
      required: false,
      placeholder: 'your-newsapi-key',
      setupUrl: 'https://newsapi.org',
      setupSteps: [
        'Go to newsapi.org',
        'Sign up',
        'Copy your API key from the dashboard',
      ],
      cost: 'FREE: 100 requests/day',
      why: 'Enrich prospect profiles with recent company news and industry updates.',
    },
    {
      id: 'crunchbase',
      name: 'Crunchbase',
      icon: '📊',
      description: 'Company data and funding info',
      required: false,
      placeholder: 'your-crunchbase-key',
      setupUrl: 'https://data.crunchbase.com',
      setupSteps: [
        'Go to data.crunchbase.com',
        'Sign up for API access',
        'Copy your API key',
      ],
      cost: 'Plans start at $29/month',
      why: 'Get company funding, employee count, and industry data for prospect enrichment.',
    },
    {
      id: 'rapidapi',
      name: 'RapidAPI',
      icon: '🔗',
      description: 'API marketplace (LinkedIn, etc.)',
      required: false,
      placeholder: 'your-rapidapi-key',
      setupUrl: 'https://rapidapi.com',
      setupSteps: [
        'Go to rapidapi.com',
        'Sign up',
        'Subscribe to APIs you need (e.g., LinkedIn)',
        'Copy your RapidAPI key from the dashboard',
      ],
      cost: 'Varies by API',
      why: 'Access LinkedIn data and other third-party APIs for prospect research.',
    },
  ];

  // Custom API Keys state
  const [_customKeys, _setCustomKeys] = useState<Array<{id: string, name: string, key: string}>>([]);
  const [_showAddCustom, _setShowAddCustom] = useState(false);
  const [_newCustomKey, _setNewCustomKey] = useState({name: '', key: ''});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Settings
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              API Keys Setup
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Connect external services to enable features. Add keys here instead of messing with .env files.
            </p>
          </div>

          {/* OpenRouter Recommendation Banner */}
          <div style={{ backgroundColor: 'var(--color-success-dark)', border: '2px solid var(--color-success)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-success)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⭐ We Recommend: OpenRouter
            </h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-border-light)', lineHeight: '1.7' }}>
              <p style={{ marginBottom: '0.75rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                For maximum simplicity and best value, use <strong style={{ color: 'var(--color-success)' }}>OpenRouter</strong> as your AI provider.
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>Why we recommend it:</strong>
              </p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-border-light)' }}>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>One key</strong> gives you access to 100+ AI models (GPT-4, Claude, Gemini, Llama, and more)</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Simpler setup</strong> - No need to manage multiple API keys from different providers</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Usually cheaper</strong> - Often 20-30% less expensive than going direct to OpenAI</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Better reliability</strong> - Automatic failover if one provider has issues</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ <strong>Easy switching</strong> - Try different models without getting new API keys</li>
              </ul>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
                📝 Get your OpenRouter key at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-success)', textDecoration: 'underline' }}>openrouter.ai</a> (takes 2 minutes)
              </p>
            </div>
          </div>

          {/* What You Need Banner */}
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
              ⚡ What You Need to Get Started
            </h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--color-success)' }}>REQUIRED (AI features won&apos;t work without these):</strong>
              </p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
                <li>OpenAI API Key - Powers all AI features ($10-50/month)</li>
                <li>SendGrid API Key - Actually sends emails ($20/month)</li>
              </ul>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--color-warning)' }}>OPTIONAL (but highly recommended):</strong>
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
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '1rem',
                  padding: '2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>{service.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                        {service.name}
                      </h3>
                      {service.required && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: 'var(--color-success)',
                          color: 'var(--color-bg-main)',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: '700',
                        }}>
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                      {service.description}
                    </p>
                    
                    {/* Why do I need this? */}
                    <details style={{ marginBottom: '1rem' }}>
                      <summary style={{ fontSize: '0.75rem', color: primaryColor, cursor: 'pointer', marginBottom: '0.5rem' }}>
                        Why do I need this? • Cost: {service.cost}
                      </summary>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                        <p style={{ marginBottom: '0.5rem' }}><strong>What it does:</strong> {service.why}</p>
                        <p><strong>Cost:</strong> {service.cost}</p>
                      </div>
                    </details>

                    {/* Setup Instructions */}
                    <details style={{ marginBottom: '1rem' }}>
                      <summary style={{ fontSize: '0.75rem', color: primaryColor, cursor: 'pointer', marginBottom: '0.5rem' }}>
                        📖 Show setup instructions
                      </summary>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
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
                          backgroundColor: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        onClick={() => void saveKey(service.id, keys[service.id] || '')}
                        disabled={!keys[service.id] || saving === service.id}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: saveResults[service.id] === 'success' ? 'var(--color-success, #22c55e)' : keys[service.id] ? primaryColor : 'var(--color-border-strong)',
                          color: 'var(--color-text-primary)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: keys[service.id] && saving !== service.id ? 'pointer' : 'not-allowed',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          minWidth: '5rem',
                        }}
                      >
                        {saving === service.id ? 'Saving...' : saveResults[service.id] === 'success' ? 'Saved!' : 'Save'}
                      </button>
                      <button
                        onClick={() => void testKey(service.id)}
                        disabled={!keys[service.id] || testing === service.id}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: 'var(--color-success)',
                          color: 'var(--color-text-primary)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: keys[service.id] && testing !== service.id ? 'pointer' : 'not-allowed',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        {testing === service.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => void deleteKey(service.id)}
                        disabled={!keys[service.id] || saving === service.id}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: !keys[service.id] ? 'var(--color-border-strong)' : 'var(--color-error, #ef4444)',
                          color: 'var(--color-text-primary)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: keys[service.id] && saving !== service.id ? 'pointer' : 'not-allowed',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          opacity: keys[service.id] ? 1 : 0.5,
                        }}
                        title="Remove this API key"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Test Result */}
                    {testResults[service.id] && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: testResults[service.id].success ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
                        border: `1px solid ${testResults[service.id].success ? 'var(--color-success)' : 'var(--color-error)'}`,
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        color: testResults[service.id].success ? 'var(--color-success-light)' : 'var(--color-error-light)',
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
