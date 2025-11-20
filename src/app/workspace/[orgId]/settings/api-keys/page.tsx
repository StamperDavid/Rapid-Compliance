'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { APIKeysConfig } from '@/types/api-keys';

export default function APIKeysPage() {
  const organizationId = 'demo'; // TODO: Get from route params
  
  const [keys, setKeys] = useState<Partial<APIKeysConfig>>({
    firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' },
    googleCloud: { projectId: '', location: 'us-central1' },
    ai: { openrouterApiKey: '' },
    payments: {},
    email: {},
    sms: {},
  });
  
  const [expandedCard, setExpandedCard] = useState<string | null>('openrouter');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    const loadedKeys = await apiKeyService.getKeys(organizationId);
    if (loadedKeys) {
      setKeys(loadedKeys);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await apiKeyService.saveKeys(organizationId, keys);
      setSaveMessage({ type: 'success', message: 'API keys saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', message: error.message || 'Failed to save API keys' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateKey = (path: string[], value: any) => {
    setKeys(prev => {
      const newKeys = { ...prev };
      let current: any = newKeys;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newKeys;
    });
  };

  const toggleKeyVisibility = (keyName: string) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(prev => prev === cardId ? null : cardId);
    setActiveCategory(null);
  };

  // Service categories
  const categories = {
    'AI Services': [
      { id: 'openrouter', label: 'OpenRouter (Recommended)', icon: '🚀' },
      { id: 'ai-openai', label: 'OpenAI', icon: '🤖' },
      { id: 'ai-anthropic', label: 'Anthropic (Claude)', icon: '🧠' },
      { id: 'ai-gemini', label: 'Google Gemini', icon: '✨' },
      { id: 'ai-cohere', label: 'Cohere', icon: '🔮' },
    ],
    'Firebase & Backend': [
      { id: 'firebase', label: 'Firebase & GCP', icon: '🔥' },
    ],
    'Payments': [
      { id: 'stripe', label: 'Stripe', icon: '💳' },
      { id: 'paypal', label: 'PayPal', icon: '🅿️' },
      { id: 'square', label: 'Square', icon: '🟦' },
    ],
    'Email': [
      { id: 'sendgrid', label: 'SendGrid', icon: '📧' },
      { id: 'resend', label: 'Resend', icon: '✉️' },
      { id: 'mailgun', label: 'Mailgun', icon: '📮' },
    ],
    'SMS & Communication': [
      { id: 'twilio', label: 'Twilio', icon: '📱' },
      { id: 'vonage', label: 'Vonage', icon: '📞' },
    ],
    'Storage': [
      { id: 's3', label: 'Amazon S3', icon: '☁️' },
      { id: 'gcs', label: 'Google Cloud Storage', icon: '🗄️' },
      { id: 'cloudinary', label: 'Cloudinary', icon: '🖼️' },
    ],
    'Analytics & Other': [
      { id: 'analytics', label: 'Google Analytics', icon: '📊' },
      { id: 'slack', label: 'Slack', icon: '💬' },
      { id: 'hubspot', label: 'HubSpot', icon: '🎯' },
    ],
  };

  const SecureInput = ({ label, value, onChange, keyName, placeholder, required = false }: any) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={showKeys[keyName] ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '0.625rem 2.5rem 0.625rem 0.875rem',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontFamily: 'monospace'
          }}
        />
        <button
          type="button"
          onClick={() => toggleKeyVisibility(keyName)}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#666',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.75rem'
          }}
        >
          {showKeys[keyName] ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );

  const TextInput = ({ label, value, onChange, placeholder, required = false }: any) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.625rem 0.875rem',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '0.5rem',
          fontSize: '0.875rem'
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Dashboard
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#333' }}></div>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>API Keys Configuration</h1>
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>Configure your own API keys for all services</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '0.625rem 1.5rem',
                backgroundColor: '#6366f1',
                color: 'white',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                opacity: isSaving ? 0.5 : 1
              }}
            >
              {isSaving ? 'Saving...' : 'Save All Keys'}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div style={{ backgroundColor: '#7f1d1d', borderBottom: '1px solid #991b1b' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-start">
            <span style={{ color: '#fbbf24', fontSize: '1.125rem', marginRight: '0.75rem' }}>⚠️</span>
            <div className="flex-1">
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fca5a5' }}>White-Label Configuration</h3>
              <p style={{ fontSize: '0.875rem', color: '#fecaca', marginTop: '0.25rem' }}>
                This platform requires you to provide your own API keys. You are responsible for all API costs and usage. 
                Keys are stored encrypted and are never shared with other organizations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Message Toast */}
      {saveMessage && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 50,
          backgroundColor: saveMessage.type === 'success' ? '#065f46' : '#7f1d1d',
          color: saveMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontWeight: '600',
          border: `1px solid ${saveMessage.type === 'success' ? '#10b981' : '#dc2626'}`
        }}>
          {saveMessage.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section - OpenRouter Featured */}
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '3rem',
          border: '1px solid #4f46e5'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '2rem' }}>🚀</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white', margin: 0 }}>Recommended: OpenRouter</h2>
                <span style={{ 
                  padding: '0.25rem 0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: 'white', 
                  borderRadius: '9999px', 
                  fontSize: '0.75rem', 
                  fontWeight: '600' 
                }}>BEST VALUE</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.125rem', marginBottom: '1rem', lineHeight: '1.6' }}>
                Access 100+ AI models with a single API key
              </p>
              <ul style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>✓</span> GPT-4, Claude 3.5, Gemini 2.0, Llama 3, and 100+ more models
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>✓</span> Unified billing - one invoice for all AI usage
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>✓</span> Pay only $0.001 per 1K tokens (up to 100x cheaper than direct APIs)
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>✓</span> Automatic fallback if one provider is down
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✓</span> No need to manage multiple AI provider accounts
                </li>
              </ul>
            </div>
            <div style={{ minWidth: '320px', maxWidth: '400px' }}>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <SecureInput 
                  label="OpenRouter API Key" 
                  value={keys.ai?.openrouterApiKey} 
                  onChange={(v: string) => updateKey(['ai', 'openrouterApiKey'], v)} 
                  keyName="openrouter" 
                  placeholder="sk-or-v1-..."
                  required 
                />
                <a 
                  href="https://openrouter.ai/keys" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-block',
                    marginTop: '0.75rem',
                    color: 'white', 
                    fontSize: '0.875rem',
                    textDecoration: 'underline',
                    fontWeight: '500'
                  }}
                >
                  Get your OpenRouter API key (Free $5 credit) →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Category Navigation with Dropdowns */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#ccc', marginBottom: '1rem' }}>Additional Services by Category</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(categories).map(([categoryName, services]) => (
              <div 
                key={categoryName}
                style={{ position: 'relative' }}
                onMouseEnter={() => setActiveCategory(categoryName)}
                onMouseLeave={() => setActiveCategory(null)}
              >
                <button
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#222';
                    e.currentTarget.style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    if (activeCategory !== categoryName) {
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                      e.currentTarget.style.borderColor = '#333';
                    }
                  }}
                >
                  {categoryName}
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>▼</span>
                </button>

                {/* Dropdown Menu */}
                {activeCategory === categoryName && (
                  <>
                    {/* Invisible bridge to prevent hover gap */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      height: '0.5rem',
                      zIndex: 49
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.5rem)',
                      left: 0,
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      minWidth: '220px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                      zIndex: 50,
                      overflow: 'hidden'
                    }}>
                    {services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => {
                          toggleCard(service.id);
                          // Scroll to the card
                          setTimeout(() => {
                            const element = document.getElementById(`card-${service.id}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          backgroundColor: expandedCard === service.id ? '#1a1a1a' : 'transparent',
                          color: expandedCard === service.id ? '#6366f1' : '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (expandedCard !== service.id) {
                            e.currentTarget.style.backgroundColor = '#1a1a1a';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (expandedCard !== service.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: '1.25rem' }}>{service.icon}</span>
                        <span>{service.label}</span>
                        {expandedCard === service.id && (
                          <span style={{ marginLeft: 'auto', color: '#6366f1', fontSize: '0.875rem' }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Service Configuration Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* OpenRouter */}
          {expandedCard === 'openrouter' && (
            <div id="card-openrouter" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🚀</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>OpenRouter</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Access 100+ AI models with one API key</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput 
                  label="OpenRouter API Key" 
                  value={keys.ai?.openrouterApiKey} 
                  onChange={(v: string) => updateKey(['ai', 'openrouterApiKey'], v)} 
                  keyName="openrouter" 
                  placeholder="sk-or-v1-..."
                  required 
                />
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>
                  Get your OpenRouter API key (Free $5 credit) →
                </a>
              </div>
            </div>
          )}
          
          {/* OpenAI */}
          {expandedCard === 'ai-openai' && (
            <div id="card-ai-openai" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>OpenAI</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>GPT-4, GPT-3.5, DALL-E, and Whisper models</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="API Key" value={keys.ai?.openaiApiKey} onChange={(v: string) => updateKey(['ai', 'openaiApiKey'], v)} keyName="openai" placeholder="sk-..." />
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get OpenAI API key →</a>
              </div>
            </div>
          )}

          {/* Anthropic */}
          {expandedCard === 'ai-anthropic' && (
            <div id="card-ai-anthropic" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🧠</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Anthropic (Claude)</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Claude 3.5 Sonnet, Opus, and Haiku models</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="API Key" value={keys.ai?.anthropicApiKey} onChange={(v: string) => updateKey(['ai', 'anthropicApiKey'], v)} keyName="anthropic" placeholder="sk-ant-..." />
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get Anthropic API key →</a>
              </div>
            </div>
          )}

          {/* Google Gemini */}
          {expandedCard === 'ai-gemini' && (
            <div id="card-ai-gemini" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>✨</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Google Gemini</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Gemini 2.0 Flash, Pro, and Ultra models</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="API Key" value={keys.ai?.geminiApiKey} onChange={(v: string) => updateKey(['ai', 'geminiApiKey'], v)} keyName="gemini" placeholder="AIzaSy..." />
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get Gemini API key →</a>
              </div>
            </div>
          )}

          {/* Firebase */}
          {expandedCard === 'firebase' && (
            <div id="card-firebase" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🔥</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Firebase & Google Cloud</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Authentication, database, storage, and hosting</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="Firebase API Key" value={keys.firebase?.apiKey} onChange={(v: string) => updateKey(['firebase', 'apiKey'], v)} keyName="firebase-api" placeholder="AIzaSy..." required />
                <TextInput label="Auth Domain" value={keys.firebase?.authDomain} onChange={(v: string) => updateKey(['firebase', 'authDomain'], v)} placeholder="your-app.firebaseapp.com" required />
                <TextInput label="Project ID" value={keys.firebase?.projectId} onChange={(v: string) => updateKey(['firebase', 'projectId'], v)} placeholder="your-project-id" required />
                <TextInput label="Storage Bucket" value={keys.firebase?.storageBucket} onChange={(v: string) => updateKey(['firebase', 'storageBucket'], v)} placeholder="your-app.appspot.com" />
                <TextInput label="Messaging Sender ID" value={keys.firebase?.messagingSenderId} onChange={(v: string) => updateKey(['firebase', 'messagingSenderId'], v)} placeholder="1234567890" />
                <TextInput label="App ID" value={keys.firebase?.appId} onChange={(v: string) => updateKey(['firebase', 'appId'], v)} placeholder="1:1234567890:web:..." />
                <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get Firebase keys →</a>
              </div>
            </div>
          )}

          {/* Stripe */}
          {expandedCard === 'stripe' && (
            <div id="card-stripe" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>💳</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Stripe Payments</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Accept payments, subscriptions, and invoices</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Publishable Key" value={keys.payments?.stripe?.publicKey} onChange={(v: string) => updateKey(['payments', 'stripe', 'publicKey'], v)} placeholder="pk_..." />
                <SecureInput label="Secret Key" value={keys.payments?.stripe?.secretKey} onChange={(v: string) => updateKey(['payments', 'stripe', 'secretKey'], v)} keyName="stripe-secret" placeholder="sk_..." />
                <SecureInput label="Webhook Secret" value={keys.payments?.stripe?.webhookSecret} onChange={(v: string) => updateKey(['payments', 'stripe', 'webhookSecret'], v)} keyName="stripe-webhook" placeholder="whsec_..." />
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get Stripe keys →</a>
              </div>
            </div>
          )}

          {/* PayPal */}
          {expandedCard === 'paypal' && (
            <div id="card-paypal" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🅿️</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>PayPal</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>PayPal checkout and payments</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Client ID" value={keys.payments?.paypal?.clientId} onChange={(v: string) => updateKey(['payments', 'paypal', 'clientId'], v)} placeholder="AY..." />
                <SecureInput label="Client Secret" value={keys.payments?.paypal?.clientSecret} onChange={(v: string) => updateKey(['payments', 'paypal', 'clientSecret'], v)} keyName="paypal-secret" placeholder="EL..." />
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Mode</label>
                  <select value={keys.payments?.paypal?.mode || 'sandbox'} onChange={(e) => updateKey(['payments', 'paypal', 'mode'], e.target.value)} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SendGrid */}
          {expandedCard === 'sendgrid' && (
            <div id="card-sendgrid" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>📧</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>SendGrid Email</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Transactional and marketing emails</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="API Key" value={keys.email?.sendgrid?.apiKey} onChange={(v: string) => updateKey(['email', 'sendgrid', 'apiKey'], v)} keyName="sendgrid" placeholder="SG..." />
                <TextInput label="From Email" value={keys.email?.sendgrid?.fromEmail} onChange={(v: string) => updateKey(['email', 'sendgrid', 'fromEmail'], v)} placeholder="noreply@yourcompany.com" />
                <TextInput label="From Name" value={keys.email?.sendgrid?.fromName} onChange={(v: string) => updateKey(['email', 'sendgrid', 'fromName'], v)} placeholder="Your Company" />
              </div>
            </div>
          )}

          {/* Resend */}
          {expandedCard === 'resend' && (
            <div id="card-resend" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>✉️</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Resend Email</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Modern email API for developers</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="API Key" value={keys.email?.resend?.apiKey} onChange={(v: string) => updateKey(['email', 'resend', 'apiKey'], v)} keyName="resend" placeholder="re_..." />
                <TextInput label="From Email" value={keys.email?.resend?.fromEmail} onChange={(v: string) => updateKey(['email', 'resend', 'fromEmail'], v)} placeholder="noreply@yourcompany.com" />
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.875rem', textDecoration: 'underline' }}>Get Resend key →</a>
              </div>
            </div>
          )}

          {/* Twilio */}
          {expandedCard === 'twilio' && (
            <div id="card-twilio" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>📱</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Twilio SMS</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>SMS, voice, and WhatsApp messaging</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Account SID" value={keys.sms?.twilio?.accountSid} onChange={(v: string) => updateKey(['sms', 'twilio', 'accountSid'], v)} placeholder="AC..." />
                <SecureInput label="Auth Token" value={keys.sms?.twilio?.authToken} onChange={(v: string) => updateKey(['sms', 'twilio', 'authToken'], v)} keyName="twilio" placeholder="..." />
                <TextInput label="Phone Number" value={keys.sms?.twilio?.phoneNumber} onChange={(v: string) => updateKey(['sms', 'twilio', 'phoneNumber'], v)} placeholder="+1234567890" />
              </div>
            </div>
          )}

          {/* AWS S3 */}
          {expandedCard === 's3' && (
            <div id="card-s3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>☁️</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Amazon S3</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Cloud object storage</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Access Key ID" value={keys.storage?.s3?.accessKeyId} onChange={(v: string) => updateKey(['storage', 's3', 'accessKeyId'], v)} placeholder="AKIA..." />
                <SecureInput label="Secret Access Key" value={keys.storage?.s3?.secretAccessKey} onChange={(v: string) => updateKey(['storage', 's3', 'secretAccessKey'], v)} keyName="s3-secret" placeholder="..." />
                <TextInput label="Region" value={keys.storage?.s3?.region} onChange={(v: string) => updateKey(['storage', 's3', 'region'], v)} placeholder="us-east-1" />
                <TextInput label="Bucket Name" value={keys.storage?.s3?.bucket} onChange={(v: string) => updateKey(['storage', 's3', 'bucket'], v)} placeholder="your-bucket-name" />
              </div>
            </div>
          )}

          {/* Google Cloud Storage */}
          {expandedCard === 'gcs' && (
            <div id="card-gcs" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🗄️</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Google Cloud Storage</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Scalable object storage</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Project ID" value={keys.googleCloud?.projectId} onChange={(v: string) => updateKey(['googleCloud', 'projectId'], v)} placeholder="your-gcp-project" />
                <TextInput label="Bucket Name" value={keys.storage?.cloudStorage?.bucketName} onChange={(v: string) => updateKey(['storage', 'cloudStorage', 'bucketName'], v)} placeholder="your-bucket-name" />
              </div>
            </div>
          )}

          {/* Slack */}
          {expandedCard === 'slack' && (
            <div id="card-slack" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>💬</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Slack</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Team notifications and webhooks</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SecureInput label="Webhook URL" value={keys.integrations?.slack?.webhookUrl} onChange={(v: string) => updateKey(['integrations', 'slack', 'webhookUrl'], v)} keyName="slack-webhook" placeholder="https://hooks.slack.com/services/..." />
              </div>
            </div>
          )}

          {/* Google Analytics */}
          {expandedCard === 'analytics' && (
            <div id="card-analytics" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem' }}>📊</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', margin: 0 }}>Google Analytics</h3>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Website analytics and tracking</p>
                </div>
                <button onClick={() => setExpandedCard(null)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextInput label="Measurement ID" value={keys.analytics?.googleAnalytics?.measurementId} onChange={(v: string) => updateKey(['analytics', 'googleAnalytics', 'measurementId'], v)} placeholder="G-XXXXXXXXXX" />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const ServiceCard: React.FC<ServiceCardProps> = ({ id, icon, title, description, badge, badgeColor, expanded, onToggle, children }) => {
  return null; // Not used anymore
};
