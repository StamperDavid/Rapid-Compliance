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
  Loader2,
  Shield,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/hooks/useToast';
import { INTEGRATION_PROVIDERS, type IntegrationProvider, type ConnectedIntegration } from '@/types/integrations';
import { orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import Link from 'next/link';
import type { Organization } from '@/types/organization';

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

/**
 * Admin Support View: Organization Integrations
 *
 * This page allows platform admins to view and manage integrations
 * for any tenant organization without leaving the admin context.
 * Jasper and UnifiedSidebar remain mounted throughout navigation.
 */
export default function AdminOrgIntegrationsPage() {
  const { hasPermission, adminUser } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;
  const toast = useToast();

  // Organization data for header context
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<IntegrationProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(null);

  // God Mode permission check - admin can manage any org's integrations
  const canManageIntegrations = hasPermission('canEditOrganizations');

  // Load organization details for context header
  useEffect(() => {
    async function loadOrganization() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/integrations/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  // Fetch connected integrations with pagination - scoped to target org
  const fetchIntegrations = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
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
    void refresh();
  }, [refresh]);

  const handleConnect = (provider: IntegrationProvider) => {
    if (!canManageIntegrations) {
      toast.error('You do not have permission to modify this organization\'s integrations');
      return;
    }

    if (provider.requiresOAuth) {
      // Redirect to OAuth flow with target org context
      window.location.href = `/api/integrations/oauth/authorize?provider=${provider.id}&orgId=${orgId}&adminMode=true`;
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
        connectedBy: `admin:${adminUser?.id ?? 'unknown'}`,
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/integrations`,
        integration.id,
        integration,
        false
      );

      await refresh();
      toast.success(`${INTEGRATION_PROVIDERS[providerId].name} connected for ${organization?.name ?? orgId}!`);
    } catch (error: unknown) {
      logger.error('Failed to save integration:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/integrations/page.tsx' });
      toast.error('Failed to connect integration');
    }
  };

  const promptDisconnect = (integrationId: string) => {
    if (!canManageIntegrations) {
      toast.error('You do not have permission to modify this organization\'s integrations');
      return;
    }
    setPendingDisconnectId(integrationId);
    setShowDisconnectModal(true);
  };

  const handleDisconnect = async () => {
    if (!pendingDisconnectId) {
      return;
    }

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.delete(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/integrations`,
        pendingDisconnectId
      );
      await refresh();
      toast.success('Integration disconnected successfully');
    } catch (error: unknown) {
      logger.error('Failed to disconnect integration:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/integrations/page.tsx' });
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

  // Admin theme colors
  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        {/* Admin Context Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Back Navigation */}
          <Link
            href={`/admin/organizations/${orgId}`}
            style={{
              color: '#666',
              textDecoration: 'none',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Organization
          </Link>

          {/* God Mode Banner */}
          <div
            style={{
              backgroundColor: '#1a1a2e',
              border: `1px solid ${primaryColor}40`,
              borderRadius: '0.75rem',
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.5rem',
                backgroundColor: `${primaryColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
                Admin Support View
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                Managing integrations for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
              </div>
            </div>
            {canManageIntegrations && (
              <div style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#10b98120',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                color: '#10b981',
                fontWeight: '600'
              }}>
                Full Access
              </div>
            )}
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Plug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Integrations</h1>
              <p className="text-gray-400">
                View and manage this organization&apos;s connected services
              </p>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 rounded-xl"
            style={{ backgroundColor: '#ef444420', border: '1px solid #ef444440' }}
          >
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Connected Integrations */}
        {connectedIntegrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-xl"
            style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
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
                const integrationData = integration as ConnectedIntegration;
                const CategoryIcon = categoryIcons[integrationData.category as keyof typeof categoryIcons] || Plug;

                return (
                  <motion.div
                    key={integrationData.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #22c55e40',
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <CategoryIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{integrationData.providerName}</div>
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Connected
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => promptDisconnect(integrationData.id)}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                        title="Disconnect"
                      >
                        <Settings className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                      </button>
                    </div>

                    <div className="text-sm text-gray-400 mb-3">
                      Used {integrationData.usageCount} times
                    </div>

                    {canManageIntegrations && (
                      <button
                        onClick={() => promptDisconnect(integrationData.id)}
                        className="w-full px-3 py-2 rounded-lg transition text-sm font-medium flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: '#ef444420',
                          border: '1px solid #ef444440',
                          color: '#f87171'
                        }}
                      >
                        <X className="w-4 h-4" />
                        Disconnect
                      </button>
                    )}
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
                  className="px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#ffffff10',
                    border: '1px solid #ffffff20',
                    color: '#fff'
                  }}
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
              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors"
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
              }}
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
                className="px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-2"
                style={{
                  backgroundColor: isSelected ? primaryColor : bgPaper,
                  border: `1px solid ${isSelected ? primaryColor : borderColor}`,
                  color: isSelected ? '#fff' : '#9ca3af',
                }}
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
                className="p-6 rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: bgPaper,
                  border: `1px solid ${isConnected ? '#22c55e40' : borderColor}`,
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CategoryIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{provider.name}</h3>
                      {provider.isPopular && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md mt-1"
                          style={{
                            backgroundColor: '#eab30820',
                            border: '1px solid #eab30840',
                            color: '#fbbf24'
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          POPULAR
                        </span>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <div
                      className="px-2.5 py-1 text-xs rounded-lg font-semibold flex items-center gap-1"
                      style={{
                        backgroundColor: '#22c55e20',
                        border: '1px solid #22c55e40',
                        color: '#4ade80'
                      }}
                    >
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
                        className="px-2.5 py-1 text-gray-300 text-xs rounded-lg"
                        style={{
                          backgroundColor: '#ffffff08',
                          border: '1px solid #ffffff10'
                        }}
                      >
                        {capability.name}
                      </span>
                    ))}
                    {provider.capabilities.length > 3 && (
                      <span
                        className="px-2.5 py-1 text-gray-400 text-xs rounded-lg"
                        style={{
                          backgroundColor: '#ffffff08',
                          border: '1px solid #ffffff10'
                        }}
                      >
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
                    className="w-full px-4 py-2.5 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#ffffff08',
                      border: '1px solid #ffffff10',
                      color: '#fff'
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={!canManageIntegrations}
                    className="w-full px-4 py-2.5 font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: primaryColor,
                      color: '#fff'
                    }}
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
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: `${primaryColor}10`,
                border: '1px solid #ffffff10'
              }}
            >
              <Search className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No integrations found</div>
            <div className="text-gray-400">Try adjusting your search or filter criteria</div>
          </motion.div>
        )}

        {/* API Key Modal */}
        {showAPIKeyModal && pendingProvider && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-6 max-w-md w-full"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                Connect {pendingProvider.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Enter the API key for {organization?.name ?? 'this organization'}
              </p>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter API key..."
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none mb-4"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                }}
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
                  className="flex-1 px-4 py-2.5 rounded-xl transition-all"
                  style={{
                    backgroundColor: '#ffffff08',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAPIKeySubmit}
                  disabled={!apiKeyInput.trim()}
                  className="flex-1 px-4 py-2.5 font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: primaryColor,
                    color: '#fff'
                  }}
                >
                  Connect
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Disconnect Confirmation Modal */}
        {showDisconnectModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-6 max-w-md w-full"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                Disconnect Integration
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Are you sure you want to disconnect this integration from {organization?.name ?? 'this organization'}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    setPendingDisconnectId(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl transition-all"
                  style={{
                    backgroundColor: '#ffffff08',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleDisconnect()}
                  className="flex-1 px-4 py-2.5 rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: '#ef444420',
                    border: '1px solid #ef444440',
                    color: '#f87171'
                  }}
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
