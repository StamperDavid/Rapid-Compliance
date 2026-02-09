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
import { DealHealthCard } from '@/components/crm/DealHealthCard';
import { NextBestActionsCard } from '@/components/crm/NextBestActionsCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getSubCollection } from '@/lib/firebase/collections';
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
        const collectionPath = `${getSubCollection('workspaces')}/default/entities/deals/records`;
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
      const response = await fetch('/api/crm/deals/monitor/start', {
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
      const response = await fetch('/api/crm/deals/health-check', {
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-main)',
        }}
      >
        <div style={{ color: 'var(--color-text-primary)' }}>Loading Living Ledger...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: 'var(--color-text-primary)',
            margin: 0,
            marginBottom: '0.5rem',
          }}
        >
          🧠 CRM Living Ledger
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', margin: 0 }}>
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
          backgroundColor: 'var(--color-bg-main)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
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
            fontWeight: '600',
            fontSize: '0.875rem',
            opacity: monitoringEnabled ? 0.6 : 1,
          }}
        >
          {monitoringEnabled ? '✓ Monitoring Active' : '▶️ Start Real-Time Monitoring'}
        </button>

        <button
          onClick={() => void handleHealthCheck()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
          }}
        >
          🏥 Run Health Check
        </button>

        {healthCheckSummary != null && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              paddingLeft: '1.5rem',
              borderLeft: '1px solid var(--color-border-strong)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>TOTAL DEALS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                {healthCheckSummary.total}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>HEALTHY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-success)' }}>
                {healthCheckSummary.healthy}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>AT RISK</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                {healthCheckSummary.atRisk}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>CRITICAL</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-error)' }}>
                {healthCheckSummary.critical}
              </div>
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
              fontWeight: '700',
              color: 'var(--color-text-primary)',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Active Deals ({deals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {deals.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  No deals yet
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>
                  Add deals from the CRM to track health scores and get AI recommendations.
                </div>
                <a
                  href="/crm?view=deals"
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                  }}
                >
                  Go to CRM
                </a>
              </div>
            ) : deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
                style={{
                  padding: '1rem',
                  backgroundColor: selectedDealId === deal.id ? 'var(--color-bg-paper)' : 'var(--color-bg-main)',
                  border: `1px solid ${selectedDealId === deal.id ? 'var(--color-primary)' : 'var(--color-bg-paper)'}`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedDealId !== deal.id) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-main)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDealId !== deal.id) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-main)';
                  }
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  {deal.companyName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  {deal.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-success)' }}>
                    ${(deal.value / 1000).toFixed(0)}k
                  </span>
                  <span
                    style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      color: 'var(--color-primary)',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                    }}
                  >
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
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-main)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  marginBottom: '2rem',
                }}
              >
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
                  {selectedDeal.name}
                </h2>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <div>
                    Value: <span style={{ color: 'var(--color-success)', fontWeight: '700' }}>${selectedDeal.value.toLocaleString()}</span>
                  </div>
                  <div>
                    Stage: <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{selectedDeal.stage}</span>
                  </div>
                  <div>
                    Probability: <span style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>{selectedDeal.probability}%</span>
                  </div>
                  <div>
                    Close Date:{' '}
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>
                      {selectedDeal.expectedCloseDate != null && selectedDeal.expectedCloseDate instanceof Date
                        ? selectedDeal.expectedCloseDate.toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Health & Actions Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Health Score */}
                <div>
                  {selectedHealth ? (
                    <DealHealthCard health={selectedHealth} dealName={selectedDeal.companyName} />
                  ) : (
                    <div
                      style={{
                        padding: '2rem',
                        backgroundColor: 'var(--color-bg-main)',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--color-border-light)',
                        textAlign: 'center',
                        color: 'var(--color-text-disabled)',
                      }}
                    >
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
                    <div
                      style={{
                        padding: '2rem',
                        backgroundColor: 'var(--color-bg-main)',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--color-border-light)',
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
                backgroundColor: 'var(--color-bg-main)',
                borderRadius: '0.75rem',
                border: '1px solid var(--color-border-light)',
                textAlign: 'center',
                color: 'var(--color-text-disabled)',
              }}
            >
              Select a deal to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
