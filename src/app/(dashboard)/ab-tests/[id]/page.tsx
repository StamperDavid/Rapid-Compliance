'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface ABTestMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
}

interface ABTestVariant {
  id: string;
  name: string;
  description?: string;
  trafficWeight: number;
  config: Record<string, unknown>;
  metrics: ABTestMetrics;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  testType?: string;
  targetMetric?: string;
  trafficAllocation?: number;
  variants: ABTestVariant[];
  winner?: string;
  confidence?: number;
  startDate?: string;
  endDate?: string;
  createdAt: unknown;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500/20 text-gray-400' },
  running: { label: 'Running', className: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Paused', className: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', className: 'bg-blue-500/20 text-blue-400' },
};

function calculateConfidence(variants: ABTestVariant[]): number {
  if (variants.length < 2) { return 0; }
  const sorted = [...variants].sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate);
  const best = sorted[0];
  const second = sorted[1];
  const p1 = best.metrics.conversionRate / 100;
  const p2 = second.metrics.conversionRate / 100;
  const n1 = best.metrics.impressions;
  const n2 = second.metrics.impressions;
  if (n1 === 0 || n2 === 0) { return 0; }
  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));
  if (se === 0) { return 0; }
  const zScore = Math.abs((p1 - p2) / se);
  const t = 1 / (1 + 0.2316419 * zScore);
  const d = 0.3989423 * Math.exp((-zScore * zScore) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return (1 - p) * 100;
}

function generateInsights(variants: ABTestVariant[]): string[] {
  const insights: string[] = [];
  if (variants.length < 2) { return insights; }
  const sorted = [...variants].sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const improvement = best.metrics.conversionRate - worst.metrics.conversionRate;
  if (improvement > 0) {
    insights.push(`${best.name} has ${improvement.toFixed(1)}% higher conversion rate than ${worst.name}`);
  }
  if (best.metrics.revenue && worst.metrics.revenue && worst.metrics.revenue > 0) {
    const revenueGain = ((best.metrics.revenue - worst.metrics.revenue) / worst.metrics.revenue) * 100;
    insights.push(`${best.name} generates ${revenueGain.toFixed(1)}% more revenue`);
  }
  const total = variants.reduce((s, v) => s + v.metrics.impressions, 0);
  if (total < 1000) {
    insights.push(`Need more data: ${total} impressions (recommended: 1,000+)`);
  }
  return insights;
}

export default function ABTestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const testId = params.id as string;
  const [test, setTest] = useState<ABTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTest = useCallback(async () => {
    try {
      const data = await FirestoreService.get(getSubCollection('abTests'), testId);
      setTest(data as ABTest);
    } catch (error: unknown) {
      logger.error('Error loading test:', error instanceof Error ? error : new Error(String(error)), { file: 'ab-tests/[id]/page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  const updateTestStatus = async (newStatus: 'running' | 'paused' | 'completed', winnerId?: string) => {
    if (!test) { return; }
    setActionLoading(true);
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updatedAt: Timestamp.now(),
      };
      if (newStatus === 'running' && test.status === 'draft') {
        updates.startDate = new Date().toISOString();
      }
      if (newStatus === 'completed') {
        updates.endDate = new Date().toISOString();
        if (winnerId) {
          updates.winner = winnerId;
          updates.confidence = calculateConfidence(test.variants);
        }
      }
      await FirestoreService.update(getSubCollection('abTests'), testId, updates);
      setTest({ ...test, ...updates } as ABTest);
      toast.success(`Test ${newStatus === 'running' ? 'started' : newStatus}`);
    } catch (error: unknown) {
      logger.error('Error updating test status:', error instanceof Error ? error : new Error(String(error)), { file: 'ab-tests/[id]/page.tsx' });
      toast.error('Failed to update test');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !test) {
    return <div className="p-8 text-[var(--color-text-primary)]">Loading...</div>;
  }

  const confidence = calculateConfidence(test.variants);
  const insights = generateInsights(test.variants);
  const totalImpressions = test.variants.reduce((s, v) => s + v.metrics.impressions, 0);
  const bestVariant = [...test.variants].sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate)[0];
  const statusConfig = STATUS_CONFIG[test.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/ab-tests')} className="text-primary hover:underline mb-4 text-sm">&larr; Back to Tests</button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{test.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)]">{test.description}</p>
              {test.targetMetric && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Target: <span className="font-medium">{test.targetMetric}</span>
                  {test.trafficAllocation !== undefined && ` | ${test.trafficAllocation}% traffic`}
                </p>
              )}
            </div>

            {/* Lifecycle Buttons */}
            <div className="flex gap-2">
              {test.status === 'draft' && (
                <button
                  onClick={() => void updateTestStatus('running')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Start Test
                </button>
              )}
              {test.status === 'running' && (
                <>
                  <button
                    onClick={() => void updateTestStatus('paused')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => void updateTestStatus('completed')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Stop Test
                  </button>
                </>
              )}
              {test.status === 'paused' && (
                <>
                  <button
                    onClick={() => void updateTestStatus('running')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => void updateTestStatus('completed')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Stop Test
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Confidence Bar */}
        {totalImpressions > 0 && (
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Statistical Confidence</h2>
              <span className={`text-sm font-bold ${confidence >= 95 ? 'text-success' : confidence >= 80 ? 'text-yellow-400' : 'text-[var(--color-text-secondary)]'}`}>
                {confidence.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${confidence >= 95 ? 'bg-green-500' : confidence >= 80 ? 'bg-yellow-500' : 'bg-gray-500'}`}
                style={{ width: `${Math.min(confidence, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-[var(--color-text-secondary)]">
              <span>0%</span>
              <span className="text-yellow-400">80%</span>
              <span className="text-success">95% (significant)</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Variant Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {test.variants.map((variant) => {
            const impressions = variant.metrics?.impressions ?? 0;
            const conversions = variant.metrics?.conversions ?? 0;
            const rate = impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : '0.00';
            const isWinner = test.winner === variant.id;
            const isBest = variant.id === bestVariant?.id && totalImpressions > 0;

            return (
              <div
                key={variant.id}
                className={`bg-surface-paper rounded-lg p-6 border ${isWinner ? 'border-green-500' : 'border-transparent'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{variant.name}</h3>
                    {variant.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{variant.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">{variant.trafficWeight}% traffic</span>
                    {isWinner && <span className="text-success text-sm font-bold">Winner</span>}
                    {!isWinner && isBest && test.status !== 'completed' && (
                      <span className="text-xs text-yellow-400">Leading</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Impressions</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{impressions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Conversions</span>
                    <span className="font-semibold text-success">{conversions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Conversion Rate</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{rate}%</span>
                  </div>
                  {variant.metrics?.revenue !== undefined && variant.metrics.revenue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">Revenue</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">${variant.metrics.revenue.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                {/* Declare Winner button */}
                {(test.status === 'running' || test.status === 'paused') && !test.winner && (
                  <button
                    onClick={() => void updateTestStatus('completed', variant.id)}
                    disabled={actionLoading}
                    className="mt-4 w-full px-3 py-2 border border-green-600 text-green-400 rounded text-xs hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Declare Winner
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="bg-surface-paper rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Insights</h2>
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li key={idx} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
