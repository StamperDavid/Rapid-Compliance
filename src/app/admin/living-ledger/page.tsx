'use client';

/**
 * Admin Living Ledger
 * CRM deal intelligence dashboard accessible from the admin panel.
 * Uses DEFAULT_ORG_ID (rapid-compliance-root) for penthouse access.
 */

import React, { useState, useEffect } from 'react';
import { DealHealthCard } from '@/components/crm/DealHealthCard';
import { NextBestActionsCard } from '@/components/crm/NextBestActionsCard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { auth } from '@/lib/firebase/config';
import type { Deal } from '@/lib/crm/deal-service';
import type { DealHealthScore } from '@/lib/crm/deal-health';
import type { ActionRecommendations } from '@/lib/crm/next-best-action-engine';

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

interface DealsApiResponse {
  data?: DealRecord[];
  deals?: DealRecord[];
}

interface DealRecord {
  id: string;
  name?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  probability?: number;
  expectedCloseDate?: string;
  createdAt?: string;
}

export default function AdminLivingLedgerPage() {
  const { adminUser } = useAdminAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [healthScores, setHealthScores] = useState<Map<string, DealHealthScore>>(new Map());
  const [recommendations, setRecommendations] = useState<ActionRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [healthCheckSummary, setHealthCheckSummary] = useState<HealthCheckSummary | null>(null);

  // Load deals from Firestore using the CRM deals API
  useEffect(() => {
    const loadDeals = async () => {
      try {
        const token = await auth?.currentUser?.getIdToken();
        const headers: Record<string, string> = {
          'x-organization-id': DEFAULT_ORG_ID,
          'x-workspace-id': 'default',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch deals from the CRM API
        const response = await fetch('/api/crm/deals', { headers });

        if (response.ok) {
          const data = (await response.json()) as DealsApiResponse;
          const rawDeals = data.data ?? data.deals ?? [];
          const fetchedDeals: Deal[] = rawDeals.map((deal) => ({
            id: deal.id,
            name: deal.name ?? '',
            companyName: deal.companyName ?? '',
            value: deal.value ?? 0,
            stage: (deal.stage ?? 'qualification') as Deal['stage'],
            probability: deal.probability ?? 0,
            organizationId: DEFAULT_ORG_ID,
            workspaceId: 'default',
            expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : undefined,
            createdAt: deal.createdAt ? new Date(deal.createdAt) : new Date(),
          }));

          setDeals(fetchedDeals);
          if (fetchedDeals.length > 0) {
            setSelectedDealId(fetchedDeals[0].id);
          }
        } else {
          // No deals found - this is expected for empty ledgers
          logger.info('No deals found in ledger', { status: response.status });
          setDeals([]);
        }
        setLoading(false);
      } catch (error: unknown) {
        logger.error('Failed to load deals', error instanceof Error ? error : new Error(String(error)));
        setDeals([]); // Set empty array on error
        setLoading(false);
      }
    };

    void loadDeals();
  }, []);

  // Load health score for selected deal
  useEffect(() => {
    const loadHealthScore = async () => {
      if (!selectedDealId) { return; }

      try {
        const token = await auth?.currentUser?.getIdToken();
        const headers: Record<string, string> = {
          'x-organization-id': DEFAULT_ORG_ID,
          'x-workspace-id': 'default',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/health`,
          { headers }
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
  }, [selectedDealId, healthScores]);

  // Load recommendations for selected deal
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedDealId) { return; }

      try {
        const token = await auth?.currentUser?.getIdToken();
        const headers: Record<string, string> = {
          'x-organization-id': DEFAULT_ORG_ID,
          'x-workspace-id': 'default',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/recommendations`,
          { headers }
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
  }, [selectedDealId]);

  const handleStartMonitoring = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-organization-id': DEFAULT_ORG_ID,
        'x-workspace-id': 'default',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/crm/deals/monitor/start', {
        method: 'POST',
        headers,
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

  const handleHealthCheck = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-organization-id': DEFAULT_ORG_ID,
        'x-workspace-id': 'default',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/crm/deals/health-check', {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        const data = await response.json() as HealthCheckResponse;
        setHealthCheckSummary(data.data);
        logger.info('Health check complete', {
          total: data.data.total,
          healthy: data.data.healthy,
          atRisk: data.data.atRisk,
          critical: data.data.critical,
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Loading Living Ledger...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin / {adminUser?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
            CRM Living Ledger
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', margin: 0 }}>
            AI-powered deal intelligence with real-time health monitoring and next best actions
          </p>
        </div>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-border-main)',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => void handleStartMonitoring()}
            disabled={monitoringEnabled}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: monitoringEnabled ? 'var(--color-success-dark)' : 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: monitoringEnabled ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              opacity: monitoringEnabled ? 0.6 : 1,
            }}
          >
            {monitoringEnabled ? 'Monitoring Active' : 'Start Real-Time Monitoring'}
          </button>

          <button
            onClick={() => void handleHealthCheck()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Run Health Check
          </button>

          {healthCheckSummary != null && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
                paddingLeft: '1.5rem',
                borderLeft: '1px solid var(--color-border-light)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>TOTAL</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{healthCheckSummary.total}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>HEALTHY</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>{healthCheckSummary.healthy}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>AT RISK</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)' }}>{healthCheckSummary.atRisk}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>CRITICAL</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-error)' }}>{healthCheckSummary.critical}</div>
              </div>
            </div>
          )}
        </div>

        {/* Main Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
          {/* Deals List */}
          <div>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Active Deals ({deals.length})
            </h3>
            {deals.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-main)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  No deals in your ledger yet
                </div>
                <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                  Add deals via the CRM to see them here
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {deals.map((deal) => (
                  <button
                    type="button"
                    key={deal.id}
                    onClick={() => setSelectedDealId(deal.id)}
                    style={{
                      padding: '1rem',
                      backgroundColor: selectedDealId === deal.id ? 'var(--color-bg-elevated)' : 'var(--color-bg-paper)',
                      border: `1px solid ${selectedDealId === deal.id ? 'var(--color-primary)' : 'var(--color-border-main)'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      width: '100%',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                      {deal.companyName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      {deal.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-success)' }}>
                        ${(deal.value / 1000).toFixed(0)}k
                      </span>
                      <span
                        style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: 'var(--color-bg-elevated)',
                          color: 'var(--color-primary)',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                        }}
                      >
                        {deal.stage}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deal Details */}
          <div>
            {selectedDeal ? (
              <div>
                {/* Deal Header */}
                <div
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--color-border-main)',
                    marginBottom: '2rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
                    {selectedDeal.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                    <div>
                      Value: <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>${selectedDeal.value.toLocaleString()}</span>
                    </div>
                    <div>
                      Stage: <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{selectedDeal.stage}</span>
                    </div>
                    <div>
                      Probability: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{selectedDeal.probability}%</span>
                    </div>
                    <div>
                      Close Date:{' '}
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {selectedDeal.expectedCloseDate instanceof Date
                          ? selectedDeal.expectedCloseDate.toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Health & Actions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div>
                    {selectedHealth ? (
                      <DealHealthCard health={selectedHealth} dealName={selectedDeal.companyName} />
                    ) : (
                      <div
                        style={{
                          padding: '2rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          borderRadius: '0.75rem',
                          border: '1px solid var(--color-border-main)',
                          textAlign: 'center',
                          color: 'var(--color-text-disabled)',
                        }}
                      >
                        Loading health score...
                      </div>
                    )}
                  </div>
                  <div>
                    {recommendations != null ? (
                      <NextBestActionsCard
                        recommendations={recommendations}
                        onActionClick={(action) => {
                          logger.info('Action clicked', { actionId: action.id, actionTitle: action.title });
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '2rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          borderRadius: '0.75rem',
                          border: '1px solid var(--color-border-main)',
                          textAlign: 'center',
                          color: 'var(--color-text-disabled)',
                        }}
                      >
                        Loading recommendations...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '4rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-main)',
                  textAlign: 'center',
                  color: 'var(--color-text-disabled)',
                }}
              >
                {deals.length === 0 ? 'Add deals to your CRM to see them here' : 'Select a deal to view details'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
