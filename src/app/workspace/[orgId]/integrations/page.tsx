'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plug,
  Check,
  X,
  Settings,
  Search,
  CreditCard,
  Calendar,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { INTEGRATION_PROVIDERS } from '@/types/integrations';
import type { IntegrationProvider, ConnectedIntegration } from '@/types/integrations';
import type { QueryConstraint } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

const categoryIcons = {
  payment: CreditCard,
  scheduling: Calendar,
  ecommerce: ShoppingCart,
  crm: BarChart3,
  communication: MessageSquare,
};

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
        connectedBy: user?.id ?? '',
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
    if (!confirm('Are you sure you want to disconnect this integration?')) {
      return;
    }

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
    { id: 'all', name: 'All Integrations', icon: Plug },
    { id: 'payment', name: 'Payment', icon: CreditCard },
    { id: 'scheduling', name: 'Scheduling', icon: Calendar },
    { id: 'ecommerce', name: 'E-Commerce', icon: ShoppingCart },
    { id: 'crm', name: 'CRM', icon: BarChart3 },
    { id: 'communication', name: 'Communication', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Plug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Integrations</h1>
              <p className="text-gray-400">
                Connect your AI agent to the tools you already use
              </p>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-xl text-red-300"
          >
            <div className="flex items-center gap-2">
              <X className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Connected Integrations */}
        {connectedIntegrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Check className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">
                Connected Integrations ({connectedIntegrations.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedIntegrations.map((integration, index) => {
                const provider = INTEGRATION_PROVIDERS[integration.providerId];
                const CategoryIcon = categoryIcons[integration.category as keyof typeof categoryIcons] || Plug;

                return (
                  <motion.div
                    key={integration.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-black/40 backdrop-blur-xl rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/25">
                          <CategoryIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{integration.providerName}</div>
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Connected
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Disconnect"
                      >
                        <Settings className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                      </button>
                    </div>

                    <div className="text-sm text-gray-400 mb-3">
                      Used {integration.usageCount} times
                    </div>

                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="w-full px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Disconnect
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Load More for Connected Integrations */}
            {(hasMore || isLoading) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-center"
              >
                <button
                  onClick={loadMore}
                  disabled={isLoading || !hasMore}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : hasMore ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Load More ({connectedIntegrations.length} shown)
                    </>
                  ) : (
                    'All loaded'
                  )}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-12 pr-4 py-3.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-black/40 backdrop-blur-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            );
          })}
        </motion.div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider, index) => {
            const isConnected = connectedIntegrations.some(
              (i) => i.providerId === provider.id
            );
            const CategoryIcon = categoryIcons[provider.category as keyof typeof categoryIcons] || Plug;

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className={`p-6 bg-black/40 backdrop-blur-xl border rounded-xl transition-all hover:scale-[1.02] ${
                  isConnected
                    ? 'border-green-500/30 hover:border-green-500/50'
                    : 'border-white/10 hover:border-orange-500/50'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                      <CategoryIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{provider.name}</h3>
                      {provider.isPopular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-md mt-1">
                          <Sparkles className="w-3 h-3" />
                          POPULAR
                        </span>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <div className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connected
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{provider.description}</p>

                {/* Capabilities */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2 font-medium">Capabilities:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.capabilities.slice(0, 3).map((capability) => (
                      <span
                        key={capability.id}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg"
                      >
                        {capability.name}
                      </span>
                    ))}
                    {provider.capabilities.length > 3 && (
                      <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg">
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
                      if (integration) {
                        handleDisconnect(integration.id);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Plug className="w-4 h-4" />
                    Connect
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProviders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-white/10 flex items-center justify-center">
              <Search className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No integrations found</div>
            <div className="text-gray-400">Try adjusting your search or filter criteria</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
