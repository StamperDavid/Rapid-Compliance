'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Sequence Analytics Dashboard
 * 
 * Provides comprehensive analytics for omni-channel sequences:
 * - Overall performance metrics
 * - Step-by-step conversion funnels
 * - Channel performance comparison
 * - Real-time execution monitoring
 * - Top performers leaderboard
 * 
 * Uses native Hunter-Closer sequencer analytics.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SubpageNav from '@/components/ui/SubpageNav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { DateRangeFilter, type DateRange } from '@/components/analytics/DateRangeFilter';
import {
  exportSequencePerformanceToCSV,
  exportSummaryToCSV,
  exportChannelPerformanceToCSV,
  exportStepPerformanceToCSV as _exportStepPerformanceToCSV,
} from '@/lib/utils/csv-export';
import { ABTestComparison } from '@/components/analytics/ABTestComparison';
import { PerformanceTrendsChart, generateTrendDataFromAnalytics } from '@/components/analytics/PerformanceTrendsChart';

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsSummary {
  totalSequences: number;
  activeSequences: number;
  totalEnrollments: number;
  activeEnrollments: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  avgDeliveryRate: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgReplyRate: number;
  topSequencesByReplyRate: Array<{ id: string; name: string; replyRate: number }>;
  topSequencesByEngagement: Array<{ id: string; name: string; engagementScore: number }>;
  channelPerformance: {
    email: { sent: number; delivered: number; opened: number; replied: number; clicked?: number };
    linkedin: { sent: number; delivered: number; opened: number; replied: number; clicked?: number };
    sms: { sent: number; delivered: number; replied: number };
    phone: { sent: number; delivered: number; replied: number };
  };
}

interface SequencePerformance {
  sequenceId: string;
  sequenceName: string;
  isActive: boolean;
  channel: 'email' | 'linkedin' | 'phone' | 'sms' | 'multi-channel';
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  stepPerformance: StepPerformance[];
  createdAt: Date;
  lastExecutedAt?: Date;
}

interface StepPerformance {
  stepId: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface SequenceExecution {
  executionId: string;
  sequenceId: string;
  sequenceName: string;
  leadId: string;
  leadName?: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'skipped';
  executedAt: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

// API Response Types
interface AnalyticsApiResponse {
  summary: AnalyticsSummary;
  sequences: SequencePerformance[];
}

interface ExecutionsApiResponse {
  executions: SequenceExecution[];
}

interface ChannelStats {
  sent: number;
  delivered: number;
  opened?: number;
  replied: number;
  clicked?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SequenceAnalyticsPage() {
  const { user: _user } = useAuth();
  const authFetch = useAuthFetch();
  
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sequences, setSequences] = useState<SequencePerformance[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<SequencePerformance | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<SequenceExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'sequences' | 'channels' | 'monitoring'>('overview');
  
  // A/B test comparison state
  const [showABTest, setShowABTest] = useState(false);
  const [abTestSequences, setABTestSequences] = useState<[SequencePerformance | null, SequencePerformance | null]>([null, null]);
  
  // Date range filter (default to last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate, preset: '30d' };
  });

  // Load analytics data
  useEffect(() => {
    if (!PLATFORM_ID) {return;}

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        
        // Build query params with date range
        const params = new URLSearchParams();
        if (dateRange) {
          params.set('startDate', dateRange.startDate.toISOString());
          params.set('endDate', dateRange.endDate.toISOString());
        }
        
        const response = await authFetch(`/api/sequences/analytics?${params.toString()}`, {
          headers: {
            'x-organization-id': PLATFORM_ID,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load analytics');
        }

        const data = await response.json() as AnalyticsApiResponse;
        setSummary(data.summary);
        setSequences(data.sequences ?? []);

        // Load recent executions
        const executionsResponse = await authFetch(`/api/sequences/executions?limit=50`, {
          headers: {
            'x-organization-id': PLATFORM_ID,
          },
        });

        if (executionsResponse.ok) {
          const executionsData = await executionsResponse.json() as ExecutionsApiResponse;
          setRecentExecutions(executionsData.executions ?? []);
        }
      } catch (error) {
        logger.error('Error loading analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'analytics/page.tsx' });
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();

    // Auto-refresh executions every 30 seconds
    const interval = setInterval(() => {
      void (async () => {
        try {
          const executionsResponse = await authFetch(`/api/sequences/executions?limit=50`, {
            headers: {
              'x-organization-id': PLATFORM_ID,
            },
          });

          if (executionsResponse.ok) {
            const executionsData = await executionsResponse.json() as ExecutionsApiResponse;
            setRecentExecutions(executionsData.executions ?? []);
          }
        } catch (error) {
          logger.error('Error refreshing executions:', error instanceof Error ? error : new Error(String(error)), { file: 'analytics/page.tsx' });
        }
      })();
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange, authFetch]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <p>No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', padding: '2rem' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <SubpageNav items={[
            { label: 'Overview', href: '/analytics' },
            { label: 'Revenue', href: '/analytics/revenue' },
            { label: 'Pipeline', href: '/analytics/pipeline' },
            { label: 'Sales Performance', href: '/analytics/sales' },
            { label: 'Sequences', href: '/sequences/analytics' },
          ]} />
          <Link href={`/outbound/sequences`} style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
            ← Back to Sequences
          </Link>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                📊 Sequence Analytics
              </h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                Performance insights across all omni-channel sequences
              </p>
            </div>
            
            {/* Export Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {activeView === 'overview' && summary && (
                <>
                  <button
                    onClick={() => exportSummaryToCSV(summary, dateRange)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    📥 Export Summary
                  </button>
                  <button
                    onClick={() => exportSequencePerformanceToCSV(sequences)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    📊 Export All Sequences
                  </button>
                </>
              )}
              
              {activeView === 'sequences' && (
                <button
                  onClick={() => exportSequencePerformanceToCSV(sequences)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  📥 Export Sequences
                </button>
              )}
              
              {activeView === 'channels' && summary && (
                <button
                  onClick={() => exportChannelPerformanceToCSV(summary.channelPerformance)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  📥 Export Channels
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div style={{ marginBottom: '2rem' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border-light)', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveView('overview')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'transparent',
              color: activeView === 'overview' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: `3px solid ${activeView === 'overview' ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('sequences')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'transparent',
              color: activeView === 'sequences' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: `3px solid ${activeView === 'sequences' ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Sequence Performance
          </button>
          <button
            onClick={() => setActiveView('channels')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'transparent',
              color: activeView === 'channels' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: `3px solid ${activeView === 'channels' ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Channel Breakdown
          </button>
          <button
            onClick={() => setActiveView('monitoring')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'transparent',
              color: activeView === 'monitoring' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: `3px solid ${activeView === 'monitoring' ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Live Monitoring
          </button>
        </div>

        {/* Overview Tab */}
        {activeView === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <MetricCard
                label="Total Sequences"
                value={summary.totalSequences}
                subtitle={`${summary.activeSequences} active`}
                icon="🎯"
              />
              <MetricCard
                label="Total Enrollments"
                value={summary.totalEnrollments}
                subtitle={`${summary.activeEnrollments} active`}
                icon="👥"
              />
              <MetricCard
                label="Messages Sent"
                value={summary.totalSent}
                subtitle={`${summary.totalDelivered} delivered`}
                icon="📤"
              />
              <MetricCard
                label="Avg Reply Rate"
                value={`${summary.avgReplyRate.toFixed(1)}%`}
                subtitle="across all sequences"
                icon="💬"
                highlight={summary.avgReplyRate > 5}
              />
            </div>

            {/* Engagement Funnel */}
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                Engagement Funnel
              </h2>
              <FunnelChart
                stages={[
                  { label: 'Sent', value: summary.totalSent, color: 'var(--color-primary)' },
                  { label: 'Delivered', value: summary.totalDelivered, color: 'var(--color-secondary)' },
                  { label: 'Opened', value: summary.totalOpened, color: 'var(--color-secondary)' },
                  { label: 'Clicked', value: summary.totalClicked, color: 'var(--color-secondary-light)' },
                  { label: 'Replied', value: summary.totalReplied, color: 'var(--color-success)' },
                ]}
              />
            </div>

            {/* Performance Trends */}
            <div style={{ marginBottom: '2rem' }}>
              <PerformanceTrendsChart
                data={generateTrendDataFromAnalytics(sequences, dateRange)}
                title="📈 Performance Trends Over Time"
              />
            </div>

            {/* Top Performers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
                  🏆 Top by Reply Rate
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {summary.topSequencesByReplyRate.slice(0, 5).map((seq, index) => (
                    <div
                      key={seq.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-elevated)',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const perf = sequences.find(s => s.sequenceId === seq.id);
                        if (perf) {
                          setSelectedSequence(perf);
                          setActiveView('sequences');
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-disabled)', fontSize: '1.25rem', fontWeight: 'bold' }}>
                          #{index + 1}
                        </span>
                        <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                          {seq.name}
                        </span>
                      </div>
                      <span style={{ color: 'var(--color-success)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {seq.replyRate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
                  ⚡ Top by Engagement
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {summary.topSequencesByEngagement.slice(0, 5).map((seq, index) => (
                    <div
                      key={seq.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-elevated)',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const perf = sequences.find(s => s.sequenceId === seq.id);
                        if (perf) {
                          setSelectedSequence(perf);
                          setActiveView('sequences');
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-disabled)', fontSize: '1.25rem', fontWeight: 'bold' }}>
                          #{index + 1}
                        </span>
                        <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                          {seq.name}
                        </span>
                      </div>
                      <span style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {seq.engagementScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sequence Performance Tab */}
        {activeView === 'sequences' && (
          <div>
            {selectedSequence ? (
              <SequenceDetailView
                sequence={selectedSequence}
                onBack={() => setSelectedSequence(null)}
              />
            ) : (
              <>
                {/* A/B Test Comparison Banner */}
                {sequences.length >= 2 && (
                  <div style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: '0.75rem',
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                        🆚 Compare Sequences
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {abTestSequences[0] && abTestSequences[1] ? (
                          <>Comparing: <strong style={{ color: 'var(--color-primary)' }}>{abTestSequences[0].sequenceName}</strong> vs <strong style={{ color: 'var(--color-primary)' }}>{abTestSequences[1].sequenceName}</strong></>
                        ) : abTestSequences[0] || abTestSequences[1] ? (
                          <>Select one more sequence to compare</>
                        ) : (
                          <>Click on two sequences below to compare them side by side</>
                        )}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {abTestSequences[0] && abTestSequences[1] && (
                        <button
                          onClick={() => setShowABTest(true)}
                          style={{
                            padding: '0.75rem 1.25rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text-primary)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          View Comparison
                        </button>
                      )}
                      {(abTestSequences[0] ?? abTestSequences[1]) && (
                        <button
                          onClick={() => setABTestSequences([null, null])}
                          style={{
                            padding: '0.75rem 1.25rem',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {sequences.map((seq) => {
                    const isSelectedForAB = abTestSequences[0]?.sequenceId === seq.sequenceId || abTestSequences[1]?.sequenceId === seq.sequenceId;
                    
                    return (
                    <div
                      key={seq.sequenceId}
                      style={{
                        backgroundColor: 'var(--color-bg-paper)',
                        border: `2px solid ${isSelectedForAB ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        borderRadius: '1rem',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                        position: 'relative',
                      }}
                      onClick={(e) => {
                        // Check if shift key is pressed for A/B test selection
                        if (e.shiftKey) {
                          e.preventDefault();
                          if (abTestSequences[0]?.sequenceId === seq.sequenceId) {
                            setABTestSequences([null, abTestSequences[1]]);
                          } else if (abTestSequences[1]?.sequenceId === seq.sequenceId) {
                            setABTestSequences([abTestSequences[0], null]);
                          } else if (!abTestSequences[0]) {
                            setABTestSequences([seq, abTestSequences[1]]);
                          } else if (!abTestSequences[1]) {
                            setABTestSequences([abTestSequences[0], seq]);
                          } else {
                            setABTestSequences([seq, abTestSequences[1]]);
                          }
                        } else {
                          setSelectedSequence(seq);
                        }
                      }}
                      onMouseEnter={(e) => !isSelectedForAB && (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                      onMouseLeave={(e) => !isSelectedForAB && (e.currentTarget.style.borderColor = 'var(--color-border-light)')}
                    >
                      {isSelectedForAB && (
                        <div style={{
                          position: 'absolute',
                          top: '0.75rem',
                          right: '0.75rem',
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                        }}>
                          {abTestSequences[0]?.sequenceId === seq.sequenceId ? 'A' : 'B'}
                        </div>
                      )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                        {seq.sequenceName}
                      </h3>
                      <StatusBadge isActive={seq.isActive} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <ChannelBadge channel={seq.channel} />
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                        {seq.stepPerformance.length} steps
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sent</div>
                        <div style={{ fontSize: '1.125rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{seq.totalSent}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Opened</div>
                        <div style={{ fontSize: '1.125rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{seq.totalOpened}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Clicked</div>
                        <div style={{ fontSize: '1.125rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{seq.totalClicked}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Replied</div>
                        <div style={{ fontSize: '1.125rem', color: 'var(--color-success)', fontWeight: '600' }}>{seq.totalReplied}</div>
                      </div>
                    </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <MetricPill label="Open" value={`${seq.openRate.toFixed(1)}%`} />
                        <MetricPill label="Click" value={`${seq.clickRate.toFixed(1)}%`} />
                        <MetricPill label="Reply" value={`${seq.replyRate.toFixed(1)}%`} highlight={seq.replyRate > 5} />
                      </div>
                      
                      {/* Hint for A/B test */}
                      {!isSelectedForAB && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-disabled)', textAlign: 'center' }}>
                          Hold Shift + Click to select for A/B test
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* A/B Test Comparison Modal */}
        {showABTest && abTestSequences[0] && abTestSequences[1] && (
          <ABTestComparison
            sequenceA={abTestSequences[0]}
            sequenceB={abTestSequences[1]}
            onClose={() => setShowABTest(false)}
          />
        )}

        {/* Channel Breakdown Tab */}
        {activeView === 'channels' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <ChannelPerformanceCard
              channel="email"
              icon="📧"
              stats={summary.channelPerformance.email}
            />
            <ChannelPerformanceCard
              channel="linkedin"
              icon="💼"
              stats={summary.channelPerformance.linkedin}
            />
            <ChannelPerformanceCard
              channel="sms"
              icon="💬"
              stats={summary.channelPerformance.sms}
            />
            <ChannelPerformanceCard
              channel="phone"
              icon="📞"
              stats={summary.channelPerformance.phone}
            />
          </div>
        )}

        {/* Live Monitoring Tab */}
        {activeView === 'monitoring' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  Real-Time Execution Monitor
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  Auto-refreshes every 30 seconds • {recentExecutions.length} recent executions
                </p>
              </div>
              <div style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-bg-main)',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
                LIVE
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', overflow: 'hidden' }}>
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {recentExecutions.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-disabled)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                    <p>No recent executions. Sequences will appear here when they execute.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {recentExecutions.map((execution) => (
                      <div
                        key={execution.executionId}
                        style={{
                          padding: '1rem 1.5rem',
                          borderBottom: '1px solid var(--color-border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                        }}
                      >
                        <ExecutionStatusBadge status={execution.status} />
                        <ChannelBadge channel={execution.channel} small />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                            <strong>{execution.sequenceName}</strong> → {execution.leadName ?? execution.leadId}
                          </div>
                          <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                            Step {execution.stepIndex + 1}: {execution.action}
                            {execution.error && (
                              <span style={{ color: 'var(--color-error)', marginLeft: '0.5rem' }}>
                                • Error: {execution.error}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem', textAlign: 'right', minWidth: '120px' }}>
                          {formatRelativeTime(new Date(execution.executedAt))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {return 'Just now';}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  if (diffHours < 24) {return `${diffHours}h ago`;}
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return date.toLocaleDateString();
}

// ============================================================================
// COMPONENTS
// ============================================================================

function MetricCard({ label, value, subtitle, icon, highlight }: {
  label: string;
  value: number | string;
  subtitle: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: `1px solid ${highlight ? 'var(--color-success)' : 'var(--color-border-light)'}`,
      borderRadius: '1rem',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>{label}</div>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '2rem', color: highlight ? 'var(--color-success)' : 'var(--color-text-primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>{subtitle}</div>
    </div>
  );
}

function FunnelChart({ stages }: { stages: Array<{ label: string; value: number; color: string }> }) {
  const maxValue = Math.max(...stages.map(s => s.value));
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {stages.map((stage, index) => {
        const percentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
        const conversionRate = index > 0 && stages[index - 1].value > 0
          ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
          : '100.0';
        
        return (
          <div key={stage.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{stage.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {index > 0 && (
                  <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                    {conversionRate}% of previous
                  </span>
                )}
                <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                  {stage.value.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ height: '2.5rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percentage}%`,
                  backgroundColor: stage.color,
                  transition: 'width 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '1rem',
                }}
              >
                {percentage > 15 && (
                  <span style={{ color: 'var(--color-text-primary)', fontSize: '0.75rem', fontWeight: '600' }}>
                    {percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SequenceDetailView({ sequence, onBack }: { sequence: SequencePerformance; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          marginBottom: '1.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'var(--color-bg-elevated)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        ← Back to All Sequences
      </button>

      <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              {sequence.sequenceName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ChannelBadge channel={sequence.channel} />
              <StatusBadge isActive={sequence.isActive} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Reply Rate</div>
            <div style={{ fontSize: '2rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
              {sequence.replyRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Enrolled</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{sequence.totalEnrolled}</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Delivery Rate</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{sequence.deliveryRate.toFixed(1)}%</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Open Rate</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{sequence.openRate.toFixed(1)}%</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Click Rate</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{sequence.clickRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Step Performance */}
      <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
          Step-by-Step Performance
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sequence.stepPerformance.map((step) => (
            <div key={step.stepId} style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      color: 'var(--color-text-secondary)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      Step {step.stepIndex + 1}
                    </span>
                    <ChannelBadge channel={step.channel} small />
                  </div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{step.action}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sent</div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{step.sent}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Delivered</div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{step.delivered}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Opened</div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{step.opened}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Clicked</div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{step.clicked}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Replied</div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--color-success)', fontWeight: '600' }}>{step.replied}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <MetricPill label="Delivery" value={`${step.deliveryRate.toFixed(1)}%`} />
                <MetricPill label="Open" value={`${step.openRate.toFixed(1)}%`} />
                <MetricPill label="Click" value={`${step.clickRate.toFixed(1)}%`} />
                <MetricPill label="Reply" value={`${step.replyRate.toFixed(1)}%`} highlight={step.replyRate > 5} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelPerformanceCard({ channel, icon, stats }: {
  channel: string;
  icon: string;
  stats: ChannelStats;
}) {
  const sent = stats.sent ?? 0;
  const delivered = stats.delivered ?? 0;
  const opened = stats.opened ?? 0;
  const replied = stats.replied ?? 0;

  const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
  const replyRate = delivered > 0 ? (replied / delivered) * 100 : 0;

  return (
    <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
          {channel}
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sent</div>
          <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{sent}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Delivered</div>
          <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{delivered}</div>
        </div>
        {channel !== 'phone' && channel !== 'sms' && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Opened</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{opened}</div>
          </div>
        )}
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Replied</div>
          <div style={{ fontSize: '1.5rem', color: 'var(--color-success)', fontWeight: '600' }}>{replied}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <MetricPill label="Delivery Rate" value={`${deliveryRate.toFixed(1)}%`} />
        {channel !== 'phone' && channel !== 'sms' && (
          <MetricPill label="Open Rate" value={`${openRate.toFixed(1)}%`} />
        )}
        <MetricPill label="Reply Rate" value={`${replyRate.toFixed(1)}%`} highlight={replyRate > 5} />
      </div>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span style={{
      padding: '0.25rem 0.75rem',
      backgroundColor: isActive ? 'var(--color-success)' : 'var(--color-bg-elevated)',
      color: isActive ? 'var(--color-bg-main)' : 'var(--color-text-secondary)',
      borderRadius: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: '700',
      textTransform: 'uppercase',
    }}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function ChannelBadge({ channel, small }: { channel: string; small?: boolean }) {
  const icons: Record<string, string> = {
    email: '📧',
    linkedin: '💼',
    phone: '📞',
    sms: '💬',
    'multi-channel': '🔀',
  };

  return (
    <span style={{
      padding: small ? '0.125rem 0.5rem' : '0.25rem 0.75rem',
      backgroundColor: 'var(--color-bg-elevated)',
      color: 'var(--color-text-secondary)',
      borderRadius: '0.25rem',
      fontSize: small ? '0.625rem' : '0.75rem',
      fontWeight: '600',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
    }}>
      {icons[channel]} {channel}
    </span>
  );
}

function MetricPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      backgroundColor: highlight ? 'var(--color-success)' : 'var(--color-bg-paper)',
      borderRadius: '0.375rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: '0.75rem', color: highlight ? 'var(--color-bg-main)' : 'var(--color-text-secondary)' }}>{label}:</span>
      <span style={{ fontSize: '0.75rem', color: highlight ? 'var(--color-bg-main)' : 'var(--color-text-primary)', fontWeight: '600', marginLeft: '0.5rem' }}>
        {value}
      </span>
    </div>
  );
}

function ExecutionStatusBadge({ status }: { status: 'pending' | 'executing' | 'success' | 'failed' | 'skipped' }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', label: '⏳ Pending' },
    executing: { bg: 'var(--color-primary)', color: 'var(--color-text-primary)', label: '⚡ Executing' },
    success: { bg: 'var(--color-success)', color: 'var(--color-bg-main)', label: '✅ Success' },
    failed: { bg: 'var(--color-error)', color: 'var(--color-text-primary)', label: '❌ Failed' },
    skipped: { bg: 'var(--color-warning)', color: 'var(--color-bg-main)', label: '⏭️ Skipped' },
  };

  const style = styles[status];

  return (
    <span style={{
      padding: '0.25rem 0.75rem',
      backgroundColor: style.bg,
      color: style.color,
      borderRadius: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: '700',
      minWidth: '90px',
      textAlign: 'center',
    }}>
      {style.label}
    </span>
  );
}
