'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { INTEGRATION_PROVIDERS } from '@/types/integrations';
import type { IntegrationProvider, ConnectedIntegration } from '@/types/integrations';
import type { QueryConstraint } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function IntegrationsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch connected integrations with pagination
  const fetchIntegrations = useCallback(async (lastDoc?: any) => {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    const constraints: QueryConstraint[] = [
      orderBy('connectedAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/integrations`,
      constraints,
      50,
      lastDoc
    );
  }, [orgId]);

  const {
    data: connectedIntegrations,
    loading: isLoading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchIntegrations });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnect = async (provider: IntegrationProvider) => {
    if (provider.requiresOAuth) {
      // Redirect to OAuth flow
      window.location.href = `/api/integrations/oauth/authorize?provider=${provider.id}&orgId=${orgId}`;
    } else if (provider.requiresAPIKey) {
      // Show API key input modal
      const apiKey = prompt(`Enter your ${provider.name} API key:`);
      if (apiKey) {
        await saveIntegration(provider.id, { apiKey });
      }
    }
  };

  const saveIntegration = async (providerId: string, config: any) => {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const integration: ConnectedIntegration = {
        id: `integration_${Date.now()}`,
        organizationId: orgId,
        provider: providerId,
        providerId,
        providerName: INTEGRATION_PROVIDERS[providerId].name,
        category: INTEGRATION_PROVIDERS[providerId].category,
        authType: 'api_key',
        config,
        status: 'active',
        usageCount: 0,
        connectedAt: new Date().toISOString(),
        connectedBy: user?.id || '',
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/integrations`,
        integration.id,
        integration,
        false
      );

      await refresh(); // Refresh pagination
      alert(`${INTEGRATION_PROVIDERS[providerId].name} connected successfully!`);
    } catch (error) {
      logger.error('Failed to save integration:', error, { file: 'page.tsx' });
      alert('Failed to connect integration');
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) {return;}

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.delete(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/integrations`,
        integrationId
      );
      await refresh(); // Refresh pagination
    } catch (error) {
      logger.error('Failed to disconnect integration:', error, { file: 'page.tsx' });
      alert('Failed to disconnect integration');
    }
  };

  const providers = Object.values(INTEGRATION_PROVIDERS);
  const filteredProviders = providers.filter(provider => {
    const matchesCategory = selectedCategory === 'all' || provider.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', name: 'All Integrations', icon: '🔗' },
    { id: 'payment', name: 'Payment', icon: '💳' },
    { id: 'scheduling', name: 'Scheduling', icon: '📅' },
    { id: 'ecommerce', name: 'E-Commerce', icon: '🛒' },
    { id: 'crm', name: 'CRM', icon: '📊' },
    { id: 'communication', name: 'Communication', icon: '💬' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
          <p className="text-gray-400">
            Connect your AI agent to the tools you already use
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Connected Integrations */}
        {connectedIntegrations.length > 0 && (
          <div className="mb-8 p-6 bg-gray-800 border border-gray-700 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">
              Connected Integrations ({connectedIntegrations.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedIntegrations.map((integration) => {
                const provider = INTEGRATION_PROVIDERS[integration.providerId];
                return (
                  <div
                    key={integration.id}
                    className="p-4 bg-gray-700 rounded-lg border border-green-500/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-2xl">
                          {provider?.category === 'payment' && '💳'}
                          {provider?.category === 'scheduling' && '📅'}
                          {provider?.category === 'ecommerce' && '🛒'}
                          {provider?.category === 'crm' && '📊'}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{integration.providerName}</div>
                          <div className="text-xs text-green-400">● Connected</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 mb-3">
                      Used {integration.usageCount} times
                    </div>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="w-full px-3 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Load More for Connected Integrations */}
            {(hasMore || isLoading) && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading || !hasMore}
                  className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : hasMore ? `Load More (${connectedIntegrations.length} shown)` : 'All loaded'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>

        {/* Category Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                selectedCategory === category.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => {
            const isConnected = connectedIntegrations.some(
              (i) => i.providerId === provider.id
            );

            return (
              <div
                key={provider.id}
                className={`p-6 bg-gray-800 border rounded-xl hover:border-purple-500 transition ${
                  isConnected ? 'border-green-500' : 'border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl">
                      {provider.category === 'payment' && '💳'}
                      {provider.category === 'scheduling' && '📅'}
                      {provider.category === 'ecommerce' && '🛒'}
                      {provider.category === 'crm' && '📊'}
                      {provider.category === 'communication' && '💬'}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{provider.name}</h3>
                      {provider.isPopular && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded mt-1">
                          POPULAR
                        </span>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded font-semibold">
                      ✓ Connected
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4">{provider.description}</p>

                {/* Capabilities */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">Capabilities:</div>
                  <div className="flex flex-wrap gap-1">
                    {provider.capabilities.slice(0, 3).map((capability) => (
                      <span
                        key={capability.id}
                        className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        {capability.name}
                      </span>
                    ))}
                    {provider.capabilities.length > 3 && (
                      <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                        +{provider.capabilities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {isConnected ? (
                  <button
                    onClick={() => {
                      const integration = connectedIntegrations.find(
                        (i) => i.providerId === provider.id
                      );
                      if (integration) {handleDisconnect(integration.id);}
                    }}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                  >
                    Manage
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl text-gray-400">No integrations found</div>
          </div>
        )}
      </div>
    </div>
  );
}
