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
import { logger } from '@/lib/logger/logger';
import type { Deal } from '@/lib/crm/deal-service';
import type { DealHealthScore } from '@/lib/crm/deal-health';
import type { ActionRecommendations } from '@/lib/crm/next-best-action-engine';

export default function LivingLedgerPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [healthScores, setHealthScores] = useState<Map<string, DealHealthScore>>(new Map());
  const [recommendations, setRecommendations] = useState<ActionRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [healthCheckSummary, setHealthCheckSummary] = useState<any>(null);

  // Load deals
  useEffect(() => {
    const loadDeals = async () => {
      try {
        // For demo purposes, using mock data
        // In production, this would fetch from Firestore
        const mockDeals: Deal[] = [
          {
            id: 'deal-1',
            organizationId: user?.organizationId || 'default-org',
            workspaceId: 'default',
            name: 'Q1 2024 Enterprise Contract - Acme Corp',
            companyName: 'Acme Corp',
            value: 125000,
            stage: 'negotiation',
            probability: 75,
            expectedCloseDate: new Date('2024-03-15'),
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'deal-2',
            organizationId: user?.organizationId || 'default-org',
            workspaceId: 'default',
            name: 'Startup Package - TechFlow',
            companyName: 'TechFlow Inc',
            value: 50000,
            stage: 'proposal',
            probability: 60,
            expectedCloseDate: new Date('2024-02-28'),
            createdAt: new Date('2023-12-15'),
          },
          {
            id: 'deal-3',
            organizationId: user?.organizationId || 'default-org',
            workspaceId: 'default',
            name: 'Consulting Services - Global Industries',
            companyName: 'Global Industries',
            value: 200000,
            stage: 'qualification',
            probability: 40,
            expectedCloseDate: new Date('2024-04-30'),
            createdAt: new Date('2024-01-10'),
          },
        ];

        setDeals(mockDeals);
        
        // Auto-select first deal
        if (mockDeals.length > 0) {
          setSelectedDealId(mockDeals[0].id);
        }

        setLoading(false);
      } catch (error) {
        logger.error('Failed to load deals', error);
        setLoading(false);
      }
    };

    loadDeals();
  }, [user]);

  // Load health score for selected deal
  useEffect(() => {
    const loadHealthScore = async () => {
      if (!selectedDealId || !user?.organizationId) {return;}

      try {
        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/health`,
          {
            headers: {
              'x-organization-id': user.organizationId,
              'x-workspace-id': 'default',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setHealthScores(new Map(healthScores.set(selectedDealId, data.data)));
        }
      } catch (error) {
        logger.error('Failed to load health score', error, { dealId: selectedDealId });
      }
    };

    loadHealthScore();
  }, [selectedDealId, user]);

  // Load recommendations for selected deal
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedDealId || !user?.organizationId) {return;}

      try {
        const response = await fetch(
          `/api/crm/deals/${selectedDealId}/recommendations`,
          {
            headers: {
              'x-organization-id': user.organizationId,
              'x-workspace-id': 'default',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.data);
        }
      } catch (error) {
        logger.error('Failed to load recommendations', error, { dealId: selectedDealId });
      }
    };

    loadRecommendations();
  }, [selectedDealId, user]);

  // Start deal monitoring
  const handleStartMonitoring = async () => {
    try {
      const response = await fetch('/api/crm/deals/monitor/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': user?.organizationId || 'default-org',
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
    } catch (error) {
      logger.error('Failed to start monitoring', error);
    }
  };

  // Run health check
  const handleHealthCheck = async () => {
    try {
      const response = await fetch('/api/crm/deals/health-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': user?.organizationId || 'default-org',
          'x-workspace-id': 'default',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealthCheckSummary(data.data);
        logger.info('Health check complete', data.data);
      }
    } catch (error) {
      logger.error('Failed to run health check', error);
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
          backgroundColor: '#000',
        }}
      >
        <div style={{ color: '#fff' }}>Loading Living Ledger...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: '#fff',
            margin: 0,
            marginBottom: '0.5rem',
          }}
        >
          🧠 CRM Living Ledger
        </h1>
        <p style={{ fontSize: '1rem', color: '#999', margin: 0 }}>
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
          backgroundColor: '#0a0a0a',
          borderRadius: '0.75rem',
          border: '1px solid #1a1a1a',
        }}
      >
        <button
          onClick={handleStartMonitoring}
          disabled={monitoringEnabled}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: monitoringEnabled ? '#065f46' : '#6366f1',
            color: '#fff',
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
          onClick={handleHealthCheck}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
          }}
        >
          🏥 Run Health Check
        </button>

        {healthCheckSummary && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              paddingLeft: '1.5rem',
              borderLeft: '1px solid #333',
            }}
          >
            <div>
              <div style={{ fontSize: '0.625rem', color: '#666' }}>TOTAL DEALS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>
                {healthCheckSummary.total}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: '#666' }}>HEALTHY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                {healthCheckSummary.healthy}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: '#666' }}>AT RISK</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>
                {healthCheckSummary.atRisk}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', color: '#666' }}>CRITICAL</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>
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
              color: '#ccc',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Active Deals ({deals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
                style={{
                  padding: '1rem',
                  backgroundColor: selectedDealId === deal.id ? '#1a1a1a' : '#0a0a0a',
                  border: `1px solid ${selectedDealId === deal.id ? '#6366f1' : '#1a1a1a'}`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedDealId !== deal.id) {
                    e.currentTarget.style.backgroundColor = '#111';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDealId !== deal.id) {
                    e.currentTarget.style.backgroundColor = '#0a0a0a';
                  }
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                  {deal.companyName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>
                  {deal.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#10b981' }}>
                    ${(deal.value / 1000).toFixed(0)}k
                  </span>
                  <span
                    style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#1a1a1a',
                      color: '#6366f1',
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
                  backgroundColor: '#0a0a0a',
                  borderRadius: '0.75rem',
                  border: '1px solid #1a1a1a',
                  marginBottom: '2rem',
                }}
              >
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0, marginBottom: '0.5rem' }}>
                  {selectedDeal.name}
                </h2>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: '#999' }}>
                  <div>
                    Value: <span style={{ color: '#10b981', fontWeight: '700' }}>${selectedDeal.value.toLocaleString()}</span>
                  </div>
                  <div>
                    Stage: <span style={{ color: '#6366f1', fontWeight: '600' }}>{selectedDeal.stage}</span>
                  </div>
                  <div>
                    Probability: <span style={{ color: '#fff', fontWeight: '600' }}>{selectedDeal.probability}%</span>
                  </div>
                  <div>
                    Close Date:{' '}
                    <span style={{ color: '#fff', fontWeight: '600' }}>
                      {selectedDeal.expectedCloseDate?.toLocaleDateString()}
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
                        backgroundColor: '#0a0a0a',
                        borderRadius: '0.75rem',
                        border: '1px solid #1a1a1a',
                        textAlign: 'center',
                        color: '#666',
                      }}
                    >
                      Loading health score...
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                <div>
                  {recommendations ? (
                    <NextBestActionsCard
                      recommendations={recommendations}
                      onActionClick={(action) => {
                        logger.info('Action clicked', { action });
                        alert(`Action: ${action.title}\n\n${action.description}`);
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '2rem',
                        backgroundColor: '#0a0a0a',
                        borderRadius: '0.75rem',
                        border: '1px solid #1a1a1a',
                        textAlign: 'center',
                        color: '#666',
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
                backgroundColor: '#0a0a0a',
                borderRadius: '0.75rem',
                border: '1px solid #1a1a1a',
                textAlign: 'center',
                color: '#666',
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
