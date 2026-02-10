'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSubCollection } from '@/lib/firebase/collections';
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
import { useToast } from '@/hooks/useToast';
import { INTEGRATION_PROVIDERS, type IntegrationProvider, type ConnectedIntegration } from '@/types/integrations';
import { orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

interface IntegrationConfig {
  apiKey?: string;
  [key: string]: unknown;
}

const categoryIcons = {
  payment: CreditCard,
  scheduling: Calendar,
  ecommerce: ShoppingCart,
  crm: BarChart3,
  communication: MessageSquare,
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<IntegrationProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(null);

  // Fetch connected integrations with pagination
  const fetchIntegrations = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const constraints: QueryConstraint[] = [
      orderBy('connectedAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      getSubCollection('integrations'),
      constraints,
      50,
      lastDoc
    );
  }, []);

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
    void refresh();
  }, [refresh]);

  const handleConnect = (provider: IntegrationProvider) => {
    if (provider.requiresOAuth) {
      // Redirect to OAuth flow
      window.location.href = `/api/integrations/oauth/authorize?provider=${provider.id}`;
    } else if (provider.requiresAPIKey) {
      // Show API key input modal
      setPendingProvider(provider);
      setApiKeyInput('');
      setShowAPIKeyModal(true);
    }
  };

  const handleAPIKeySubmit = () => {
    if (pendingProvider && apiKeyInput.trim()) {
      void saveIntegration(pendingProvider.id, { apiKey: apiKeyInput.trim() });
      setShowAPIKeyModal(false);
      setPendingProvider(null);
      setApiKeyInput('');
    }
  };

  const saveIntegration = async (providerId: string, config: IntegrationConfig) => {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const integration: ConnectedIntegration = {
        id: `integration_${Date.now()}`,
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
        getSubCollection('integrations'),
        integration.id,
        integration,
        false
      );

      await refresh(); // Refresh pagination
      toast.success(`${INTEGRATION_PROVIDERS[providerId].name} connected successfully!`);
    } catch (error: unknown) {
      logger.error('Failed to save integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to connect integration');
    }
  };

  const promptDisconnect = (integrationId: string) => {
    setPendingDisconnectId(integrationId);
    setShowDisconnectModal(true);
  };

  const handleDisconnect = async () => {
    if (!pendingDisconnectId) {
      return;
    }

    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      await FirestoreService.delete(
        getSubCollection('integrations'),
        pendingDisconnectId
      );
      await refresh(); // Refresh pagination
      toast.success('Integration disconnected successfully');
    } catch (error: unknown) {
      logger.error('Failed to disconnect integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to disconnect integration');
    } finally {
      setShowDisconnectModal(false);
      setPendingDisconnectId(null);
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
    <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
      <div>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Plug className="w-6 h-6 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Integrations</h1>
              <p className="text-[var(--color-text-secondary)]">
                Connect your AI agent to the tools you already use
              </p>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 bg-[rgba(var(--color-error-rgb),0.1)] backdrop-blur-xl border border-[rgba(var(--color-error-rgb),0.2)] rounded-xl text-[var(--color-error)]"
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
            className="mb-8 p-6 bg-[var(--color-bg-main)]/40 backdrop-blur-xl border border-white/10 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Check className="w-5 h-5 text-[var(--color-text-primary)]" />
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Connected Integrations ({connectedIntegrations.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedIntegrations.map((integration, index) => {
                const integrationData = integration as ConnectedIntegration;
                const _provider = INTEGRATION_PROVIDERS[integrationData.providerId];
                const CategoryIcon = categoryIcons[integrationData.category as keyof typeof categoryIcons] || Plug;

                return (
                  <motion.div
                    key={integrationData.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-[var(--color-bg-main)]/40 backdrop-blur-xl rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/25">
                          <CategoryIcon className="w-5 h-5 text-[var(--color-text-primary)]" />
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--color-text-primary)]">{integrationData.providerName}</div>
                          <div className="flex items-center gap-1 text-xs text-[var(--color-success)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                            Connected
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => promptDisconnect(integrationData.id)}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Disconnect"
                      >
                        <Settings className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors" />
                      </button>
                    </div>

                    <div className="text-sm text-[var(--color-text-secondary)] mb-3">
                      Used {integrationData.usageCount} times
                    </div>

                    <button
                      onClick={() => promptDisconnect(integrationData.id)}
                      className="w-full px-3 py-2 bg-[var(--color-error)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-error-dark)] transition text-sm font-medium flex items-center justify-center gap-2" style={{ opacity: 0.7 }}
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
                  onClick={() => void loadMore()}
                  disabled={isLoading || !hasMore}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 text-[var(--color-text-primary)] rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-disabled)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg-main)]/40 backdrop-blur-xl border border-white/10 rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
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
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-[var(--color-text-primary)] shadow-lg shadow-orange-500/25'
                    : 'bg-[var(--color-bg-main)]/40 backdrop-blur-xl border border-white/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-white/20'
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
              (i) => (i as ConnectedIntegration).providerId === provider.id
            );
            const CategoryIcon = categoryIcons[provider.category as keyof typeof categoryIcons] || Plug;

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className={`p-6 bg-[var(--color-bg-main)]/40 backdrop-blur-xl border rounded-xl transition-all hover:scale-[1.02] ${
                  isConnected
                    ? 'border-green-500/30 hover:border-green-500/50'
                    : 'border-white/10 hover:border-[var(--color-primary)]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                      <CategoryIcon className="w-6 h-6 text-[var(--color-text-primary)]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)]">{provider.name}</h3>
                      {provider.isPopular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-md mt-1">
                          <Sparkles className="w-3 h-3" />
                          POPULAR
                        </span>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <div className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-[var(--color-success)] text-xs rounded-lg font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connected
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-[var(--color-text-secondary)] text-sm mb-4 line-clamp-2">{provider.description}</p>

                {/* Capabilities */}
                <div className="mb-4">
                  <div className="text-xs text-[var(--color-text-disabled)] mb-2 font-medium">Capabilities:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.capabilities.slice(0, 3).map((capability) => (
                      <span
                        key={capability.id}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-[var(--color-text-secondary)] text-xs rounded-lg"
                      >
                        {capability.name}
                      </span>
                    ))}
                    {provider.capabilities.length > 3 && (
                      <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-[var(--color-text-secondary)] text-xs rounded-lg">
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
                        (i) => (i as ConnectedIntegration).providerId === provider.id
                      ) as ConnectedIntegration | undefined;
                      if (integration) {
                        promptDisconnect(integration.id);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-[var(--color-text-primary)] rounded-xl hover:bg-white/10 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-[var(--color-text-primary)] font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
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
              <Search className="w-10 h-10 text-[var(--color-text-disabled)]" />
            </div>
            <div className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">No integrations found</div>
            <div className="text-[var(--color-text-secondary)]">Try adjusting your search or filter criteria</div>
          </motion.div>
        )}

        {/* API Key Modal */}
        {showAPIKeyModal && pendingProvider && (
          <div className="fixed inset-0 bg-[var(--color-bg-main)]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--color-bg-main)]/90 border border-white/10 rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                Connect {pendingProvider.name}
              </h3>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                Enter your API key to connect this integration
              </p>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter API key..."
                className="w-full px-4 py-3 bg-[var(--color-bg-main)]/40 border border-white/10 rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-primary)] mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAPIKeySubmit();
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAPIKeyModal(false);
                    setPendingProvider(null);
                    setApiKeyInput('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-[var(--color-text-primary)] rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAPIKeySubmit}
                  disabled={!apiKeyInput.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-[var(--color-text-primary)] font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Disconnect Confirmation Modal */}
        {showDisconnectModal && (
          <div className="fixed inset-0 bg-[var(--color-bg-main)]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--color-bg-main)]/90 border border-white/10 rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                Disconnect Integration
              </h3>
              <p className="text-[var(--color-text-secondary)] text-sm mb-6">
                Are you sure you want to disconnect this integration? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    setPendingDisconnectId(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-[var(--color-text-primary)] rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleDisconnect()}
                  className="flex-1 px-4 py-2.5 bg-[var(--color-error)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-error-dark)] transition-all font-semibold flex items-center justify-center gap-2" style={{ opacity: 0.7 }}
                >
                  <X className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
