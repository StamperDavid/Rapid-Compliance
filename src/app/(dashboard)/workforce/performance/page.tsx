/**
 * Swarm Performance Dashboard
 *
 * Displays performance metrics for all 46+ swarm specialists.
 * Shows success rate, quality scores, retry rates, and trends.
 * Allows triggering improvement analysis for low performers.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { AI_WORKFORCE_TABS } from '@/lib/constants/subpage-nav';

// ============================================================================
// TYPES
// ============================================================================

interface SpecialistMetrics {
  agentId: string;
  agentType: string;
  period: string;
  totalExecutions: number;
  successRate: number;
  averageQualityScore: number;
  retryRate: number;
  commonFailureModes: Array<{ mode: string; count: number }>;
  qualityTrend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}

interface ImprovementRequest {
  id: string;
  specialistId: string;
  specialistName: string;
  proposedChanges: Array<{
    field: string;
    currentValue: unknown;
    proposedValue: unknown;
    reason: string;
    confidence: number;
  }>;
  impactAnalysis: {
    expectedImprovement: number;
    areasImproved: string[];
    risks: string[];
    confidence: number;
  };
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  reviewedBy?: string;
  createdAt: string;
}

interface SwarmPerformanceData {
  summary: {
    totalSpecialists: number;
    totalExecutions: number;
    overallSuccessRate: number;
    lowPerformerCount: number;
    periodDays: number;
  };
  specialists: SpecialistMetrics[];
  lowPerformers: string[];
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TrendBadge({ trend }: { trend: string }) {
  const config = {
    improving: { label: 'Improving', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    declining: { label: 'Declining', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    stable: { label: 'Stable', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  }[trend] ?? { label: trend, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    applied: { label: 'Applied', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  };

  const cfg = config[status] ?? { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sublabel}</p>}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function SwarmPerformancePage() {
  const authFetch = useAuthFetch();

  // State
  const [periodDays, setPeriodDays] = useState(30);
  const [performanceData, setPerformanceData] = useState<SwarmPerformanceData | null>(null);
  const [improvementRequests, setImprovementRequests] = useState<ImprovementRequest[]>([]);
  const [gmVersions, setGmVersions] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [perfRes, reqRes] = await Promise.all([
        authFetch(`/api/swarm/performance?period=${periodDays}`),
        authFetch('/api/swarm/improvement-requests'),
      ]);

      if (perfRes.ok) {
        const data = await perfRes.json() as { success: boolean } & SwarmPerformanceData;
        if (data.success) {
          setPerformanceData(data);

          // Fetch active GM versions for each specialist
          const versionMap: Record<string, number | null> = {};
          const gmFetches = (data.specialists ?? []).map(async (s) => {
            try {
              const gmRes = await authFetch(`/api/swarm/golden-masters?specialistId=${encodeURIComponent(s.agentId)}`);
              if (gmRes.ok) {
                const gmData = await gmRes.json() as { success: boolean; versions: Array<{ version: number; isActive: boolean }> };
                if (gmData.success) {
                  const active = gmData.versions.find(v => v.isActive);
                  versionMap[s.agentId] = active ? active.version : null;
                }
              }
            } catch {
              versionMap[s.agentId] = null;
            }
          });
          await Promise.all(gmFetches);
          setGmVersions(versionMap);
        }
      }

      if (reqRes.ok) {
        const data = await reqRes.json() as { success: boolean; requests: ImprovementRequest[] };
        if (data.success) {
          setImprovementRequests(data.requests);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [authFetch, periodDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Actions
  const handleTriggerAnalysis = useCallback(async (specialistId: string, specialistName: string) => {
    setActionLoading(specialistId);
    setError(null);
    try {
      const res = await authFetch('/api/swarm/improvement-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistId, specialistName }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Analysis failed' })) as { error?: string };
        setError(errData.error ?? `Analysis failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger analysis');
    } finally {
      setActionLoading(null);
    }
  }, [authFetch, loadData]);

  const handleReviewRequest = useCallback(async (requestId: string, action: 'approve' | 'reject') => {
    setActionLoading(requestId);
    setError(null);
    try {
      const res = await authFetch(`/api/swarm/improvement-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Review failed' })) as { error?: string };
        setError(errData.error ?? `Review failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setActionLoading(null);
    }
  }, [authFetch, loadData]);

  const handleApplyRequest = useCallback(async (requestId: string) => {
    setActionLoading(`apply_${requestId}`);
    setError(null);
    try {
      const res = await authFetch(`/api/swarm/improvement-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Apply failed' })) as { error?: string };
        setError(errData.error ?? `Apply failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setActionLoading(null);
    }
  }, [authFetch, loadData]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Swarm Performance</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Swarm Performance</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <button
            onClick={() => void loadData()}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = performanceData?.summary;
  const specialists = performanceData?.specialists ?? [];
  const lowPerformers = new Set(performanceData?.lowPerformers ?? []);

  return (
    <div className="p-6 space-y-6">
      <SubpageNav items={AI_WORKFORCE_TABS} />
      {/* Inline Error Banner */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Swarm Performance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor and improve specialist agent quality
          </p>
        </div>

        <select
          value={periodDays}
          onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Active Specialists"
            value={summary.totalSpecialists}
            sublabel={`${summary.periodDays} day window`}
          />
          <SummaryCard
            label="Total Executions"
            value={summary.totalExecutions.toLocaleString()}
          />
          <SummaryCard
            label="Success Rate"
            value={`${(summary.overallSuccessRate * 100).toFixed(1)}%`}
          />
          <SummaryCard
            label="Low Performers"
            value={summary.lowPerformerCount}
            sublabel={summary.lowPerformerCount > 0 ? 'Need attention' : 'All healthy'}
          />
        </div>
      )}

      {/* Improvement Requests */}
      {improvementRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Improvement Requests ({improvementRequests.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {improvementRequests.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {req.specialistName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {req.proposedChanges.length} proposed changes &middot;
                    {' '}{Math.round(req.impactAnalysis.confidence * 100)}% confidence &middot;
                    {' '}+{req.impactAnalysis.expectedImprovement}% expected improvement
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <StatusBadge status={req.status} />
                  {req.status === 'pending_review' && (
                    <>
                      <button
                        onClick={() => void handleReviewRequest(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void handleReviewRequest(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="px-3 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && (
                    <button
                      onClick={() => void handleApplyRequest(req.id)}
                      disabled={actionLoading === `apply_${req.id}`}
                      className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading === `apply_${req.id}` ? 'Applying...' : 'Apply Changes'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specialist Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Specialist Performance
          </h2>
        </div>

        {specialists.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No performance data yet. Data will appear as specialists execute tasks.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Specialist
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Executions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Quality
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Retry Rate
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    GM Version
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {specialists.map((specialist) => {
                  const isLow = lowPerformers.has(specialist.agentId);
                  return (
                    <tr
                      key={specialist.agentId}
                      className={isLow ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {isLow && (
                            <span className="w-2 h-2 rounded-full bg-red-500 mr-2 flex-shrink-0" title="Low performer" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {specialist.agentId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                        {specialist.totalExecutions}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <span className={specialist.successRate >= 0.8 ? 'text-green-600 dark:text-green-400' : specialist.successRate >= 0.6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                          {(specialist.successRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <span className={specialist.averageQualityScore >= 80 ? 'text-green-600 dark:text-green-400' : specialist.averageQualityScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                          {specialist.averageQualityScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                        {(specialist.retryRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <TrendBadge trend={specialist.qualityTrend} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {gmVersions[specialist.agentId] != null ? (
                          <a
                            href={`/settings/ai-agents/training`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:underline"
                          >
                            v{gmVersions[specialist.agentId]}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {isLow && (
                          <button
                            onClick={() => void handleTriggerAnalysis(specialist.agentId, specialist.agentId)}
                            disabled={actionLoading === specialist.agentId}
                            className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionLoading === specialist.agentId ? 'Analyzing...' : 'Analyze'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
