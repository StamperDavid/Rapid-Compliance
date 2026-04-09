/**
 * Living Ledger Dashboard
 *
 * CRM dashboard with AI-powered deal health monitoring and next best actions.
 * Real-time intelligence via Signal Bus integration.
 *
 * Features:
 * - Deal health scores with visual indicators
 * - AI-powered next best action recommendations
 * - Real-time signal monitoring
 * - Batch health checks
 * - Automated recommendations
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DealHealthCard } from '@/components/crm/DealHealthCard';
import { NextBestActionsCard } from '@/components/crm/NextBestActionsCard';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getDealsCollection } from '@/lib/firebase/collections';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import type { Deal } from '@/lib/crm/deal-service';
import type { DealHealthScore } from '@/lib/crm/deal-health';
import type { ActionRecommendations } from '@/lib/crm/next-best-action-engine';

// API Response Types
interface HealthScoreResponse {
  data: DealHealthScore;
}

interface RecommendationsResponse {
  data: ActionRecommendations;
}

interface HealthCheckSummary {
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
}

interface HealthCheckResponse {
  data: HealthCheckSummary;
}

export default function LivingLedgerPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [healthScores, setHealthScores] = useState<Map<string, DealHealthScore>>(new Map());
  const [recommendations, setRecommendations] = useState<ActionRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [healthCheckSummary, setHealthCheckSummary] = useState<HealthCheckSummary | null>(null);

  // Load deals from Firestore
  useEffect(() => {
    if (!user) { return; }

    const loadDeals = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const collectionPath = getDealsCollection();
        const records = await FirestoreService.getAll<Deal>(collectionPath);

        setDeals(records);
        if (records.length > 0) {
          setSelectedDealId(records[0].id);
        }
      } catch (error: unknown) {
        logger.error('Failed to load deals', error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    void loadDeals();
  }, [user]);

  // Load health score for selected deal
  useEffect(() => {
    const loadHealthScore = async () => {
      if (!selectedDealId || !user) {return;}

      try {
        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/health`,
          {
            headers: {
              'x-organization-id': PLATFORM_ID,
              'x-workspace-id': 'default',
            },
          }
        );

        if (response.ok) {
          const data = await response.json() as HealthScoreResponse;
          setHealthScores(new Map(healthScores.set(selectedDealId, data.data)));
        }
      } catch (error: unknown) {
        logger.error('Failed to load health score', error instanceof Error ? error : new Error(String(error)), { dealId: selectedDealId });
      }
    };

    void loadHealthScore();
  }, [selectedDealId, user, healthScores]);

  // Load recommendations for selected deal
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedDealId || !user) {return;}

      try {
        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/recommendations`,
          {
            headers: {
              'x-organization-id': PLATFORM_ID,
              'x-workspace-id': 'default',
            },
          }
        );

        if (response.ok) {
          const data = await response.json() as RecommendationsResponse;
          setRecommendations(data.data);
        }
      } catch (error: unknown) {
        logger.error('Failed to load recommendations', error instanceof Error ? error : new Error(String(error)), { dealId: selectedDealId });
      }
    };

    void loadRecommendations();
  }, [selectedDealId, user]);

  // Start deal monitoring
  const handleStartMonitoring = async () => {
    try {
      const response = await authFetch('/api/crm/deals/monitor/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': PLATFORM_ID,
          'x-workspace-id': 'default',
        },
        body: JSON.stringify({
          autoGenerateRecommendations: true,
          autoRecalculateHealth: true,
          signalPriority: 'Medium',
        }),
      });

      if (response.ok) {
        setMonitoringEnabled(true);
        logger.info('Deal monitoring started');
      }
    } catch (error: unknown) {
      logger.error('Failed to start monitoring', error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Run health check
  const handleHealthCheck = async () => {
    try {
      const response = await authFetch('/api/crm/deals/health-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': PLATFORM_ID,
          'x-workspace-id': 'default',
        },
      });

      if (response.ok) {
        const data = await response.json() as HealthCheckResponse;
        setHealthCheckSummary(data.data);
        logger.info('Health check complete', {
          total: data.data.total,
          healthy: data.data.healthy,
          atRisk: data.data.atRisk,
          critical: data.data.critical
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to run health check', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const selectedDeal = deals.find((d) => d.id === selectedDealId);
  const selectedHealth = selectedDealId ? healthScores.get(selectedDealId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-foreground">Loading Living Ledger...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />
      {/* Header */}
      <div>
        <PageTitle className="mb-1">CRM Living Ledger</PageTitle>
        <SectionDescription>
          AI-powered deal intelligence with real-time health monitoring and next best actions
        </SectionDescription>
      </div>

      {/* Controls */}
      <div className="flex gap-4 p-4 bg-card border border-border-light rounded-xl items-center">
        <button
          onClick={() => void handleStartMonitoring()}
          disabled={monitoringEnabled}
          className="px-6 py-3 border-none rounded-lg font-semibold text-sm text-foreground cursor-pointer transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: monitoringEnabled ? 'var(--color-success-dark)' : 'var(--color-primary)',
          }}
        >
          {monitoringEnabled ? '✓ Monitoring Active' : '▶ Start Real-Time Monitoring'}
        </button>

        <button
          onClick={() => void handleHealthCheck()}
          className="px-6 py-3 bg-card border border-border-strong rounded-lg cursor-pointer font-semibold text-sm text-foreground"
        >
          Run Health Check
        </button>

        {healthCheckSummary != null && (
          <div className="flex-1 flex gap-6 items-center pl-6 border-l border-border-strong">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Total Deals</div>
              <div className="text-xl font-bold text-foreground">{healthCheckSummary.total}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Healthy</div>
              <div className="text-xl font-bold text-success">{healthCheckSummary.healthy}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">At Risk</div>
              <div className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{healthCheckSummary.atRisk}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Critical</div>
              <div className="text-xl font-bold text-error">{healthCheckSummary.critical}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid gap-8" style={{ gridTemplateColumns: '300px 1fr' }}>
        {/* Deals List */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
            Active Deals ({deals.length})
          </h3>
          <div className="flex flex-col gap-3">
            {deals.length === 0 ? (
              <div className="p-8 bg-card border border-border-light rounded-lg text-center">
                <div className="text-3xl mb-3">📊</div>
                <div className="text-sm font-semibold text-foreground mb-1">No deals yet</div>
                <div className="text-xs text-muted-foreground mb-4">
                  Add deals from the CRM to track health scores and get AI recommendations.
                </div>
                <Link
                  href="/deals"
                  className="inline-block px-4 py-2 bg-primary text-foreground rounded text-xs font-semibold no-underline"
                >
                  Go to Deals
                </Link>
              </div>
            ) : deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedDealId === deal.id
                    ? 'bg-card border-primary'
                    : 'bg-card border-card hover:bg-card'
                }`}
              >
                <div className="text-sm font-semibold text-foreground mb-1">
                  {deal.companyName}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {deal.name}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-success">
                    ${(deal.value / 1000).toFixed(0)}k
                  </span>
                  <span className="px-2 py-0.5 bg-card text-primary rounded-full text-xs font-semibold">
                    {deal.stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal Details */}
        <div>
          {selectedDeal ? (
            <div>
              {/* Deal Header */}
              <div className="p-6 bg-card border border-border-light rounded-xl mb-8">
                <h2 className="text-2xl font-black text-foreground mb-2">
                  {selectedDeal.name}
                </h2>
                <div className="flex gap-8 text-sm text-muted-foreground">
                  <div>
                    Value: <span className="text-success font-bold">${selectedDeal.value.toLocaleString()}</span>
                  </div>
                  <div>
                    Stage: <span className="text-primary font-semibold">{selectedDeal.stage}</span>
                  </div>
                  <div>
                    Probability: <span className="text-foreground font-semibold">{selectedDeal.probability}%</span>
                  </div>
                  <div>
                    Close Date:{' '}
                    <span className="text-foreground font-semibold">
                      {selectedDeal.expectedCloseDate != null && selectedDeal.expectedCloseDate instanceof Date
                        ? selectedDeal.expectedCloseDate.toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Health & Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Health Score */}
                <div>
                  {selectedHealth ? (
                    <DealHealthCard health={selectedHealth} dealName={selectedDeal.companyName} />
                  ) : (
                    <div className="p-8 bg-card border border-border-light rounded-xl text-center text-muted-foreground">
                      Loading health score...
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                <div>
                  {recommendations != null ? (
                    <NextBestActionsCard
                      recommendations={recommendations}
                      onActionClick={(action) => {
                        logger.info('Action clicked', { actionId: action.id, actionTitle: action.title });
                        toast.info(`Action: ${action.title}\n\n${action.description}`);
                      }}
                    />
                  ) : (
                    <div className="p-8 bg-card border border-border-light rounded-xl text-center text-muted-foreground">
                      Loading recommendations...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 bg-card border border-border-light rounded-xl text-center text-muted-foreground">
              Select a deal to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
