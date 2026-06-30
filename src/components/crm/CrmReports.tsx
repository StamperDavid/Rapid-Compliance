'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { CrmStatCard } from '@/components/analytics/crm/CrmStatCard';

/**
 * CRM Reports & Forecasting
 *
 * A self-contained reporting surface mounted INSIDE the CRM. Every number comes
 * from a real, deal-derived API — nothing is invented or hardcoded. When an
 * engine returns no data, an honest empty state is shown.
 *
 * Reused engines / endpoints (all compute from the real `deals` collection):
 *  - GET /api/analytics/pipeline  → pipeline value, by-stage, win rate, avg deal size, cycle
 *  - GET /api/analytics/forecast  → weighted forecast (value × probability), scenarios, confidence
 *  - GET /api/analytics/win-loss  → won/lost counts + revenue, top loss reasons
 */

// ── API response shapes ────────────────────────────────────────────────────────

interface PipelineStage {
  stage: string;
  value: number;
  count: number;
}

interface PipelineResponse {
  totalValue: number;
  dealsCount: number;
  avgDealSize: number;
  winRate: number;
  avgSalesCycle: number;
  byStage: PipelineStage[];
}

interface ForecastResponse {
  forecastedRevenue: number;
  confidence: number;
  scenarios: { bestCase: number; likely: number; worstCase: number };
  totalOpenDeals: number;
}

interface LossReason {
  reason: string;
  count: number;
  value: number;
  percentage: number;
}

interface WinLossResponse {
  totalDeals: number;
  won: number;
  lost: number;
  winRate: number;
  wonRevenue: number;
  lostRevenue: number;
  avgWonDeal: number;
  lossReasons: LossReason[];
}

// ── Type guards ────────────────────────────────────────────────────────────────

function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  return data as Record<string, unknown>;
}

function isPipelineResponse(data: unknown): data is PipelineResponse {
  const obj = asRecord(data);
  return (
    obj !== null &&
    typeof obj.totalValue === 'number' &&
    typeof obj.dealsCount === 'number' &&
    Array.isArray(obj.byStage)
  );
}

function isForecastResponse(data: unknown): data is ForecastResponse {
  const obj = asRecord(data);
  return (
    obj !== null &&
    typeof obj.forecastedRevenue === 'number' &&
    typeof obj.confidence === 'number' &&
    typeof obj.scenarios === 'object' &&
    obj.scenarios !== null
  );
}

function isWinLossResponse(data: unknown): data is WinLossResponse {
  const obj = asRecord(data);
  return (
    obj !== null &&
    typeof obj.won === 'number' &&
    typeof obj.lost === 'number' &&
    Array.isArray(obj.lossReasons)
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

// ── Component ───────────────────────────────────────────────────────────────────

export function CrmReports() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipelineRes, forecastRes, winLossRes] = await Promise.all([
        authFetch('/api/analytics/pipeline'),
        authFetch('/api/analytics/forecast'),
        authFetch('/api/analytics/win-loss?period=all'),
      ]);

      const pipelineJson: unknown = await pipelineRes.json();
      if (pipelineRes.ok && isPipelineResponse(pipelineJson)) {
        setPipeline(pipelineJson);
      }

      const forecastJson: unknown = await forecastRes.json();
      const forecastInner = asRecord(forecastJson)?.forecast;
      if (forecastRes.ok && isForecastResponse(forecastInner)) {
        setForecast(forecastInner);
      }

      const winLossJson: unknown = await winLossRes.json();
      if (winLossRes.ok && isWinLossResponse(winLossJson)) {
        setWinLoss(winLossJson);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CRM reports';
      logger.error(
        'CRM reports load failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'components/crm/CrmReports.tsx' }
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void loadReports();
  }, [authLoading, loadReports]);

  const isLoading = authLoading || loading;

  // Largest stage value used to scale the horizontal pipeline bars.
  const stages = pipeline?.byStage ?? [];
  const maxStageValue = stages.reduce((max, s) => Math.max(max, s.value), 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="mb-2">CRM Reports</PageTitle>
          <SectionDescription>
            Pipeline, forecast, and win/loss — computed live from your real deals.
          </SectionDescription>
        </div>
        <Button variant="outline" onClick={() => void loadReports()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="p-6 border border-error/40 bg-error/5">
          <p className="text-error">{error}</p>
          <Button className="mt-3" variant="outline" onClick={() => void loadReports()}>
            Retry
          </Button>
        </Card>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CrmStatCard
          label="Open Pipeline Value"
          value={pipeline ? formatCurrency(pipeline.totalValue) : '$0'}
          sublabel={pipeline ? `${pipeline.dealsCount} open deals` : undefined}
          loading={isLoading}
        />
        <CrmStatCard
          label="Weighted Forecast"
          value={forecast ? formatCurrency(forecast.forecastedRevenue) : '$0'}
          sublabel={forecast ? `${forecast.confidence}% confidence` : undefined}
          tone="success"
          loading={isLoading}
        />
        <CrmStatCard
          label="Win Rate"
          value={pipeline ? formatPercent(pipeline.winRate) : '0%'}
          sublabel={winLoss ? `${winLoss.won} won · ${winLoss.lost} lost` : undefined}
          loading={isLoading}
        />
        <CrmStatCard
          label="Avg Deal Size"
          value={pipeline ? formatCurrency(pipeline.avgDealSize) : '$0'}
          sublabel={pipeline && pipeline.avgSalesCycle > 0 ? `${pipeline.avgSalesCycle} day avg cycle` : undefined}
          loading={isLoading}
        />
      </div>

      {/* ── Pipeline value by stage ─────────────────────────────────────────── */}
      <Card className="p-8 bg-card border border-border-light rounded-2xl">
        <SectionTitle className="mb-6">Pipeline Value by Stage</SectionTitle>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-surface-elevated" />
        ) : stages.length > 0 ? (
          <div className="space-y-4">
            {stages.map((s) => (
              <div key={s.stage}>
                <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-foreground">{s.stage}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(s.value)} · {s.count} {s.count === 1 ? 'deal' : 'deals'}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-3 rounded-full bg-primary transition-all"
                    style={{ width: `${maxStageValue > 0 ? (s.value / maxStageValue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No open deals in the pipeline yet. Add deals to see pipeline value by stage.
          </div>
        )}
      </Card>

      {/* ── Forecast + Win/Loss ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weighted forecast */}
        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <SectionTitle className="mb-6">Revenue Forecast</SectionTitle>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          ) : forecast && forecast.totalOpenDeals > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Caption className="uppercase text-muted-foreground">Worst Case</Caption>
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {formatCurrency(forecast.scenarios.worstCase)}
                  </div>
                </div>
                <div>
                  <Caption className="uppercase text-muted-foreground">Likely</Caption>
                  <div className="mt-1 text-xl font-semibold text-success">
                    {formatCurrency(forecast.scenarios.likely)}
                  </div>
                </div>
                <div>
                  <Caption className="uppercase text-muted-foreground">Best Case</Caption>
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {formatCurrency(forecast.scenarios.bestCase)}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Forecast confidence</span>
                  <span>{forecast.confidence}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-3 rounded-full bg-success transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, forecast.confidence))}%` }}
                  />
                </div>
              </div>
              <SectionDescription>
                Weighted across {forecast.totalOpenDeals} open deals (value × probability).
              </SectionDescription>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No open deals to forecast from yet.
            </div>
          )}
        </Card>

        {/* Win / loss */}
        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <SectionTitle className="mb-6">Win / Loss Summary</SectionTitle>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          ) : winLoss && winLoss.totalDeals > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border-light p-4">
                  <Caption className="uppercase text-muted-foreground">Won</Caption>
                  <div className="mt-1 text-2xl font-bold text-success">{winLoss.won}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(winLoss.wonRevenue)}</div>
                </div>
                <div className="rounded-xl border border-border-light p-4">
                  <Caption className="uppercase text-muted-foreground">Lost</Caption>
                  <div className="mt-1 text-2xl font-bold text-error">{winLoss.lost}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(winLoss.lostRevenue)}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Win rate</span>
                  <span>{formatPercent(winLoss.winRate)}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-3 rounded-full bg-success transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, winLoss.winRate))}%` }}
                  />
                </div>
              </div>
              {winLoss.lossReasons.length > 0 && (
                <div>
                  <Caption className="uppercase text-muted-foreground">Top Loss Reasons</Caption>
                  <div className="mt-2 space-y-2">
                    {winLoss.lossReasons.slice(0, 4).map((reason) => (
                      <div key={reason.reason} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{reason.reason}</span>
                        <span className="text-muted-foreground">
                          {reason.count} · {formatPercent(reason.percentage)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No closed deals yet — win/loss appears once deals are marked won or lost.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
