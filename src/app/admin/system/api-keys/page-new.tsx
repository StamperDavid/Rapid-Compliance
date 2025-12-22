'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import { FirestoreService } from '@/lib/db/firestore-service';

interface IntegrationCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'essential' | 'ai' | 'communication' | 'analytics' | 'custom';
  recommended?: boolean;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    type?: 'text' | 'password' | 'url';
    help?: string;
  }>;
  docsUrl?: string;
  getStartedUrl?: string;
}

const INTEGRATION_CARDS: IntegrationCard[] = [
  // Essential
  {
    id: 'firebase',
    name: 'Firebase',
    icon: '🔥',
    description: 'Authentication and database for your platform',
    category: 'essential',
    docsUrl: 'https://console.firebase.google.com',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'AIza...', required: true },
      { key: 'authDomain', label: 'Auth Domain', placeholder: 'your-app.firebaseapp.com', required: true },
      { key: 'projectId', label: 'Project ID', placeholder: 'your-project-id', required: true },
      { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'your-app.appspot.com' },
      { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
      { key: 'appId', label: 'App ID', placeholder: '1:123:web:abc', required: true },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Payment processing and subscription billing',
    category: 'essential',
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_...', required: true },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_...', required: true, type: 'password' },
      { key: 'webhookSecret', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password' },
    ],
  },
  
  // AI
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '⭐',
    description: 'One API for 100+ AI models (GPT-4, Claude, Gemini, etc.)',
    category: 'ai',
    recommended: true,
    docsUrl: 'https://openrouter.ai/docs',
    getStartedUrl: 'https://openrouter.ai',
    fields: [
      { 
        key: 'apiKey', 
        label: 'API Key', 
        placeholder: 'sk-or-v1-...', 
        required: true,
        type: 'password',
        help: 'Recommended: One key gives access to all AI models. Usually 20-30% cheaper than direct providers.'
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4, GPT-3.5, and DALL-E models',
    category: 'ai',
    docsUrl: 'https://platform.openai.com/api-keys',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', required: true, type: 'password' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    description: 'Claude AI models (Opus, Sonnet, Haiku)',
    category: 'ai',
    docsUrl: 'https://console.anthropic.com',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-...', required: true, type: 'password' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    description: 'Google\'s Gemini AI models',
    category: 'ai',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'AIza...', required: true, type: 'password' },
    ],
  },
  
  // Communication
  {
    id: 'sendgrid',
    name: 'SendGrid',
    icon: '📧',
    description: 'Email delivery and marketing',
    category: 'communication',
    docsUrl: 'https://app.sendgrid.com/settings/api_keys',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'SG.', required: true, type: 'password' },
      { key: 'fromEmail', label: 'From Email', placeholder: 'noreply@yourdomain.com', type: 'text' },
      { key: 'fromName', label: 'From Name', placeholder: 'Your Company', type: 'text' },
    ],
  },
  {
    id: 'resend',
    name: 'Resend',
    icon: '📨',
    description: 'Modern email API for developers',
    category: 'communication',
    docsUrl: 'https://resend.com/api-keys',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 're_...', required: true, type: 'password' },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    icon: '📱',
    description: 'SMS, voice, and messaging',
    category: 'communication',
    docsUrl: 'https://console.twilio.com',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'AC...', required: true },
      { key: 'authToken', label: 'Auth Token', placeholder: 'your-auth-token', required: true, type: 'password' },
      { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1234567890' },
    ],
  },
  
  // Analytics
  {
    id: 'algolia',
    name: 'Algolia',
    icon: '🔍',
    description: 'Search and discovery',
    category: 'analytics',
    docsUrl: 'https://www.algolia.com/doc/',
    fields: [
      { key: 'appId', label: 'Application ID', placeholder: 'YOUR_APP_ID', required: true },
      { key: 'apiKey', label: 'Admin API Key', placeholder: 'your-admin-key', required: true, type: 'password' },
      { key: 'indexName', label: 'Index Name', placeholder: 'main_index' },
    ],
  },
];

export default function AdminAPIKeysPageNew() {
  const { adminUser } = useAdminAuth();
  const [keys, setKeys] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationCard | null>(null);
  const [modalData, setModalData] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const adminSettings = await FirestoreService.get('admin', 'platform-api-keys');
      if (adminSettings) {
        setKeys(adminSettings as Record<string, any>);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const openIntegrationModal = (integration: IntegrationCard) => {
    setSelectedIntegration(integration);
    
    // Load existing data for this integration
    const existingData: Record<string, string> = {};
    const integrationData = keys[integration.id] || {};
    
    integration.fields.forEach(field => {
      existingData[field.key] = integrationData[field.key] || '';
    });
    
    setModalData(existingData);
    setShowKeys({});
  };

  const closeModal = () => {
    setSelectedIntegration(null);
    setModalData({});
    setShowKeys({});
  };

  const saveIntegration = async () => {
    if (!selectedIntegration) return;
    
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updatedKeys = {
        ...keys,
        [selectedIntegration.id]: modalData,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.id || 'admin',
      };

      await FirestoreService.set('admin', 'platform-api-keys', updatedKeys);
      
      setKeys(updatedKeys);
      setSaveMessage({ type: 'success', message: `${selectedIntegration.name} configured successfully!` });
      
      setTimeout(() => {
        closeModal();
        setSaveMessage(null);
      }, 1500);
      
    } catch (error: any) {
      setSaveMessage({ type: 'error', message: error.message || 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const isIntegrationConfigured = (integrationId: string) => {
    const integrationData = keys[integrationId];
    if (!integrationData) return false;
    
    // Check if at least one field has a value
    return Object.values(integrationData).some(value => value && value !== '');
  };

  const categories = [
    { id: 'essential', name: 'Essential', icon: '⚡' },
    { id: 'ai', name: 'AI Providers', icon: '🤖' },
    { id: 'communication', name: 'Communication', icon: '📬' },
    { id: 'analytics', name: 'Analytics & Search', icon: '📊' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <p>Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/system/settings" className="text-indigo-400 hover:text-indigo-300 mb-4 inline-block">
            ← Back to System Settings
          </Link>
          <h1 className="text-3xl font-bold mb-2">Platform Integrations</h1>
          <p className="text-gray-400">
            Connect your platform to essential services. Click any card to configure.
          </p>
        </div>

        {/* Global Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
          }`}>
            {saveMessage.message}
          </div>
        )}

        {/* Categories */}
        {categories.map(category => {
          const categoryIntegrations = INTEGRATION_CARDS.filter(i => i.category === category.id);
          if (categoryIntegrations.length === 0) return null;

          return (
            <div key={category.id} className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>{category.icon}</span>
                {category.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryIntegrations.map(integration => {
                  const configured = isIntegrationConfigured(integration.id);
                  
                  return (
                    <button
                      key={integration.id}
                      onClick={() => openIntegrationModal(integration)}
                      className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg p-6 text-left transition-all group"
                    >
                      {/* Recommended Badge */}
                      {integration.recommended && (
                        <div className="absolute top-3 right-3 bg-green-500 text-black text-xs font-bold px-2 py-1 rounded">
                          RECOMMENDED
                        </div>
                      )}
                      
                      {/* Status Indicator */}
                      <div className="absolute top-3 right-3">
                        {configured ? (
                          <div className="w-3 h-3 bg-green-500 rounded-full" title="Configured"></div>
                        ) : (
                          <div className="w-3 h-3 bg-gray-600 rounded-full" title="Not configured"></div>
                        )}
                      </div>
                      
                      <div className="text-4xl mb-3">{integration.icon}</div>
                      <h3 className="text-lg font-bold mb-2">{integration.name}</h3>
                      <p className="text-sm text-gray-400 mb-4">{integration.description}</p>
                      
                      <div className="text-sm text-indigo-400 group-hover:text-indigo-300 font-medium">
                        {configured ? 'Edit Configuration →' : 'Configure Now →'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Custom Integration Card */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔧</span>
            Custom Integrations
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => alert('Custom integration builder coming soon! For now, contact support to add custom integrations.')}
              className="bg-gray-900 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg p-6 text-left transition-all group"
            >
              <div className="text-4xl mb-3">➕</div>
              <h3 className="text-lg font-bold mb-2">Add Custom Integration</h3>
              <p className="text-sm text-gray-400 mb-4">Connect any API or service</p>
              <div className="text-sm text-indigo-400 group-hover:text-indigo-300 font-medium">
                Create Custom →
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Integration Configuration Modal */}
      {selectedIntegration && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{selectedIntegration.icon}</span>
                  <h2 className="text-2xl font-bold">{selectedIntegration.name}</h2>
                  {selectedIntegration.recommended && (
                    <span className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <p className="text-gray-400">{selectedIntegration.description}</p>
                {selectedIntegration.docsUrl && (
                  <a
                    href={selectedIntegration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                  >
                    📚 View Documentation →
                  </a>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {saveMessage && (
                <div className={`mb-4 p-3 rounded ${
                  saveMessage.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
                }`}>
                  {saveMessage.message}
                </div>
              )}

              <div className="space-y-4">
                {selectedIntegration.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !showKeys[field.key] ? 'password' : 'text'}
                        value={modalData[field.key] || ''}
                        onChange={(e) => setModalData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500 pr-10"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShowKeys(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                        >
                          {showKeys[field.key] ? '👁️' : '👁️‍🗨️'}
                        </button>
                      )}
                    </div>
                    {field.help && (
                      <p className="text-xs text-gray-500 mt-1">{field.help}</p>
                    )}
                  </div>
                ))}
              </div>

              {selectedIntegration.getStartedUrl && (
                <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded p-4">
                  <p className="text-sm text-blue-200 mb-2">
                    Don't have an API key yet?
                  </p>
                  <a
                    href={selectedIntegration.getStartedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Get started with {selectedIntegration.name} →
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveIntegration}
                disabled={isSaving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}















