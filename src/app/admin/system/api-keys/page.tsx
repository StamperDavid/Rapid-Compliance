'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/db/firestore-service';

interface PlatformAPIKeys {
  // Platform Firebase (for admin/auth)
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  // Platform Stripe (for billing)
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  // Platform AI (Gemini for platform features)
  gemini: {
    apiKey: string;
  };
  // Platform Email (SendGrid/Resend for system emails)
  email: {
    sendgridApiKey?: string;
    resendApiKey?: string;
  };
  // Platform SMS (Twilio for system notifications)
  sms: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioPhoneNumber?: string;
  };
  // Platform Search (Algolia)
  search: {
    algoliaAppId?: string;
    algoliaApiKey?: string;
    algoliaIndexName?: string;
  };
}

export default function AdminAPIKeysPage() {
  const { adminUser } = useAdminAuth();
  const [keys, setKeys] = useState<PlatformAPIKeys>({
    firebase: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    },
    stripe: {
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
    },
    gemini: {
      apiKey: '',
    },
    email: {},
    sms: {},
    search: {},
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      // Check if Firestore is available
      const { db: firestoreDb } = await import('@/lib/firebase/config');
      if (!firestoreDb) {
        console.warn('Firestore not initialized. Cannot load API keys from database.');
        setLoading(false);
        return;
      }

      // Load from Firestore admin settings
      const adminSettings = await FirestoreService.get('admin', 'platform-api-keys');
      if (adminSettings) {
        setKeys(adminSettings);
      }
      // If no admin settings found, keys will remain empty (user needs to enter them)
    } catch (error) {
      console.error('Error loading API keys:', error);
      // Continue with empty keys - user can enter them
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Save to Firestore admin collection
      await FirestoreService.set('admin', 'platform-api-keys', {
        ...keys,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.id || 'admin',
      });

      setSaveMessage({ type: 'success', message: 'Platform API keys saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);

      // Reload the page to apply new Firebase config
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', message: error.message || 'Failed to save API keys' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateKey = (path: string[], value: string) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/system/settings" className="text-indigo-400 hover:text-indigo-300 mb-4 inline-block">
            ← Back to System Settings
          </Link>
          <h1 className="text-3xl font-bold mb-2">Platform API Keys</h1>
          <p className="text-gray-400">
            Manage platform-level API keys. These are used for admin features, authentication, and system services.
            <br />
            <span className="text-yellow-400 text-sm">
              ⚠️ These keys are separate from client API keys. Clients manage their own keys in their workspace settings.
            </span>
          </p>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
          }`}>
            {saveMessage.message}
          </div>
        )}

        {/* Firebase Configuration */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🔥 Firebase Configuration
            <span className="text-sm text-yellow-400 font-normal">(Required for authentication)</span>
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Platform-level Firebase credentials for user authentication and admin features.
            Get these from <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Firebase Console</a>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(keys.firebase).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {key === 'apiKey' ? 'API Key' : 
                   key === 'authDomain' ? 'Auth Domain' :
                   key === 'projectId' ? 'Project ID' :
                   key === 'storageBucket' ? 'Storage Bucket' :
                   key === 'messagingSenderId' ? 'Messaging Sender ID' :
                   'App ID'}
                </label>
                <div className="relative">
                  <input
                    type={showKeys[`firebase.${key}`] ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => updateKey(['firebase', key], e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    placeholder={`Enter ${key}`}
                  />
                  <Tooltip content={showKeys[`firebase.${key}`] ? 'Hide this API key' : 'Show this API key'}>
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(`firebase.${key}`)}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                    >
                      {showKeys[`firebase.${key}`] ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stripe Configuration */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            💳 Stripe Configuration
            <span className="text-sm text-yellow-400 font-normal">(Required for billing)</span>
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Platform-level Stripe keys for processing customer subscriptions and payments.
            Get these from <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Stripe Dashboard</a>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(keys.stripe).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {key === 'publishableKey' ? 'Publishable Key' :
                   key === 'secretKey' ? 'Secret Key' :
                   'Webhook Secret'}
                </label>
                <div className="relative">
                  <input
                    type={showKeys[`stripe.${key}`] ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => updateKey(['stripe', key], e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    placeholder={`Enter ${key}`}
                  />
                  <Tooltip content={showKeys[`stripe.${key}`] ? 'Hide this API key' : 'Show this API key'}>
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(`stripe.${key}`)}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                    >
                      {showKeys[`stripe.${key}`] ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gemini AI Configuration */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            ✨ Gemini AI Configuration
            <span className="text-sm text-gray-400 font-normal">(Optional - for platform AI features)</span>
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Platform-level Gemini API key for admin AI features.
            Get this from <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showKeys['gemini.apiKey'] ? 'text' : 'password'}
                value={keys.gemini.apiKey}
                onChange={(e) => updateKey(['gemini', 'apiKey'], e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="Enter Gemini API key"
              />
              <Tooltip content={showKeys['gemini.apiKey'] ? 'Hide this API key' : 'Show this API key'}>
                <button
                  type="button"
                  onClick={() => toggleKeyVisibility('gemini.apiKey')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                >
                  {showKeys['gemini.apiKey'] ? '👁️' : '👁️‍🗨️'}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mt-8">
          <Tooltip content="Save your platform API keys to Firestore. The page will reload to apply Firebase configuration. These keys are used for platform-level features (authentication, billing, AI).">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Platform API Keys'}
            </button>
          </Tooltip>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-300 mb-2">ℹ️ About Platform vs Client API Keys</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>Platform API Keys</strong> (this page): Used for admin features, authentication, and system services</li>
            <li>• <strong>Client API Keys</strong> (workspace settings): Clients manage their own keys for their integrations</li>
            <li>• Platform Firebase is required for user authentication across all clients</li>
            <li>• Client Firebase keys (if provided) are used for client-specific features</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

