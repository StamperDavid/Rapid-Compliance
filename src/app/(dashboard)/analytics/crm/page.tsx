'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
} from '@/components/ui/typography';
import { CrmStatCard } from '@/components/analytics/crm/CrmStatCard';
import {
  CrmDistributionDonut,
  type DonutSlice,
} from '@/components/analytics/crm/CrmDistributionDonut';

/**
 * CRM Reporting & Dashboard
 *
 * A bespoke executive surface for the CRM that exposes the existing analytics,
 * forecasting and scoring engines on one page. Every number is fetched from a
 * real API — nothing is invented client-side.
 *
 * Reused engines / endpoints:
 *  - GET  /api/analytics/pipeline      → pipeline value, by-stage, win rate, avg deal size
 *  - GET  /api/analytics/forecast      → weighted forecast, best/likely/worst, by-rep
 *  - GET  /api/analytics/lead-scoring  → score distribution, hot/top leads, avg score
 *  - POST /api/crm/deals/health-check  → deal-health distribution (healthy/at-risk/critical)
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface PipelineStage {
  stage: string;
  value: number;
  count: number;
}

interface PipelineResponse {
  success: boolean;
  totalValue: number;
  dealsCount: number;
  avgDealSize: number;
  winRate: number;
  avgSalesCycle: number;
  byStage: PipelineStage[];
}

interface ForecastByRep {
  repId: string;
  repName: string;
  forecastedRevenue: number;
  openDeals: number;
}

interface ForecastResponse {
  success: boolean;
  forecast: {
    forecastedRevenue: number;
    confidence: number;
    scenarios: { bestCase: number; likely: number; worstCase: number };
    totalOpenDeals: number;
    byRep: ForecastByRep[];
  };
}

interface ScoreBucket {
  range: string;
  count: number;
  percentage: number;
}

interface TopLead {
  id?: string;
  name: string;
  company?: string;
  score?: number;
  status?: string;
}

interface LeadScoringResponse {
  success: boolean;
  totalLeads: number;
  avgScore: number;
  distribution: ScoreBucket[];
  topLeads: TopLead[];
  conversionRate: number;
}

interface HealthCheckResponse {
  success: boolean;
  data: {
    total: number;
    healthy: number;
    atRisk: number;
    critical: number;
    recommendationsGenerated: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

function isPipelineResponse(data: unknown): data is PipelineResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.totalValue === 'number' &&
    typeof obj.dealsCount === 'number' &&
    Array.isArray(obj.byStage)
  );
}

function isForecastResponse(data: unknown): data is ForecastResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return obj.success === true && typeof obj.forecast === 'object' && obj.forecast !== null;
}

function isLeadScoringResponse(data: unknown): data is LeadScoringResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.totalLeads === 'number' && Array.isArray(obj.distribution);
}

// Score-bucket colors keyed by the label prefix returned by the lead-scoring API.
function leadBucketColor(range: string): string {
  if (range.startsWith('Hot')) {
    return 'var(--color-success)';
  }
  if (range.startsWith('Warm')) {
    return 'var(--color-primary)';
  }
  if (range.startsWith('Cool')) {
    return 'var(--color-warning)';
  }
  return 'var(--color-error)';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CrmDashboardPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse['forecast'] | null>(null);
  const [leadScoring, setLeadScoring] = useState<LeadScoringResponse | null>(null);
  const [health, setHealth] = useState<HealthCheckResponse['data'] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipelineRes, forecastRes, leadRes] = await Promise.all([
        authFetch('/api/analytics/pipeline'),
        authFetch('/api/analytics/forecast'),
        authFetch('/api/analytics/lead-scoring'),
      ]);

      const pipelineJson: unknown = await pipelineRes.json();
      if (pipelineRes.ok && isPipelineResponse(pipelineJson)) {
        setPipeline(pipelineJson);
      }

      const forecastJson: unknown = await forecastRes.json();
      if (forecastRes.ok && isForecastResponse(forecastJson)) {
        setForecast(forecastJson.forecast);
      }

      const leadJson: unknown = await leadRes.json();
      if (leadRes.ok && isLeadScoringResponse(leadJson)) {
        setLeadScoring(leadJson);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CRM dashboard';
      logger.error('CRM dashboard load failed', err instanceof Error ? err : new Error(String(err)), {
        file: 'analytics/crm/page.tsx',
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Deal-health is computed on demand: the engine iterates every active deal and
  // generates recommendations, so it must not run automatically on every load.
  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await authFetch('/api/crm/deals/health-check', { method: 'POST' });
      const json = (await res.json()) as HealthCheckResponse | { success: false; error?: string };
      if (res.ok && json.success) {
        setHealth(json.data);
      } else {
        const msg = 'error' in json && json.error ? json.error : 'Failed to run deal health check';
        setHealthError(msg);
      }
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Failed to run deal health check');
    } finally {
      setHealthLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void loadDashboard();
  }, [authLoading, loadDashboard]);

  const isLoading = authLoading || loading;

  // Derived chart data
  const stageChartData = (pipeline?.byStage ?? []).map((s) => ({
    stage: s.stage,
    value: s.value,
    count: s.count,
  }));

  const healthSlices: DonutSlice[] = health
    ? [
        { name: 'Healthy', value: health.healthy, color: 'var(--color-success)' },
        { name: 'At Risk', value: health.atRisk, color: 'var(--color-warning)' },
        { name: 'Critical', value: health.critical, color: 'var(--color-error)' },
      ]
    : [];

  const leadSlices: DonutSlice[] = (leadScoring?.distribution ?? []).map((bucket) => ({
    name: bucket.range,
    value: bucket.count,
    color: leadBucketColor(bucket.range),
  }));

  const hotLeads = (leadScoring?.topLeads ?? []).filter((l) => (l.score ?? 0) >= 80);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="mb-2">CRM Dashboard</PageTitle>
          <SectionDescription>
            Pipeline, forecast, deal health, and lead scoring at a glance — all from live CRM data.
          </SectionDescription>
        </div>
        <Button variant="outline" onClick={() => void loadDashboard()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="p-6 border border-error/40 bg-error/5">
          <p className="text-error">{error}</p>
          <Button className="mt-3" variant="outline" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </Card>
      )}

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CrmStatCard
          label="Total Pipeline Value"
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
          sublabel={pipeline ? `${pipeline.avgSalesCycle} day avg cycle` : undefined}
          loading={isLoading}
        />
        <CrmStatCard
          label="Avg Deal Size"
          value={pipeline ? formatCurrency(pipeline.avgDealSize) : '$0'}
          loading={isLoading}
        />
      </div>

      {/* ── Pipeline by stage ────────────────────────────────────────────── */}
      <Card className="p-8 bg-card border border-border-light rounded-2xl">
        <SectionTitle className="mb-6">Pipeline by Stage</SectionTitle>
        {isLoading ? (
          <div className="h-72 animate-pulse rounded-xl bg-surface-elevated" />
        ) : stageChartData.length > 0 ? (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" opacity={0.4} />
                <XAxis
                  dataKey="stage"
                  stroke="var(--color-text-secondary)"
                  style={{ fontSize: '0.75rem' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="var(--color-text-secondary)"
                  style={{ fontSize: '0.75rem' }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number, _name, item) => {
                    const count = (item?.payload as { count?: number } | undefined)?.count ?? 0;
                    return [`${formatCurrency(value)} · ${count} deals`, 'Stage'];
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-main)',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stageChartData.map((entry) => (
                    <Cell key={entry.stage} fill="var(--color-primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">No open deals in the pipeline yet.</div>
        )}
      </Card>

      {/* ── Forecast scenarios + by rep ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <SectionTitle className="mb-6">Revenue Forecast</SectionTitle>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          ) : forecast ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Worst Case</div>
                  <div className="mt-1 text-xl font-semibold text-foreground">
                    {formatCurrency(forecast.scenarios.worstCase)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Likely</div>
                  <div className="mt-1 text-xl font-semibold text-success">
                    {formatCurrency(forecast.scenarios.likely)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Best Case</div>
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
              <div className="text-xs text-muted-foreground">
                Based on {forecast.totalOpenDeals} open deals (value × probability).
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No forecast data available.</div>
          )}
        </Card>

        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <SectionTitle className="mb-6">Forecast by Rep</SectionTitle>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
          ) : forecast && forecast.byRep.length > 0 ? (
            <div className="space-y-3">
              {forecast.byRep.slice(0, 6).map((rep) => {
                const max = forecast.byRep[0]?.forecastedRevenue || 1;
                return (
                  <div key={rep.repId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-foreground">{rep.repName}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(rep.forecastedRevenue)} · {rep.openDeals} deals
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${max > 0 ? (rep.forecastedRevenue / max) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No rep forecast data available.</div>
          )}
        </Card>
      </div>

      {/* ── Deal health + lead scoring ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <SectionTitle>Deal Health</SectionTitle>
              <SectionDescription className="mt-1">
                Distribution of active deals by health status.
              </SectionDescription>
            </div>
            <Button variant="outline" onClick={() => void runHealthCheck()} disabled={healthLoading}>
              {healthLoading ? 'Checking…' : health ? 'Re-run' : 'Run check'}
            </Button>
          </div>
          {healthError && <p className="mb-3 text-sm text-error">{healthError}</p>}
          {healthLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-elevated" />
          ) : health ? (
            <>
              <CrmDistributionDonut data={healthSlices} />
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-success">{health.healthy}</div>
                  <div className="text-xs text-muted-foreground">Healthy</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-warning">{health.atRisk}</div>
                  <div className="text-xs text-muted-foreground">At Risk</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-error">{health.critical}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Run a health check to score every active deal as healthy, at-risk, or critical.
            </div>
          )}
        </Card>

        <Card className="p-8 bg-card border border-border-light rounded-2xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <SectionTitle>Lead Score Distribution</SectionTitle>
            {leadScoring && (
              <span className="text-sm text-muted-foreground">
                Avg {leadScoring.avgScore} · {leadScoring.totalLeads} leads
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-elevated" />
          ) : leadScoring && leadScoring.totalLeads > 0 ? (
            <CrmDistributionDonut data={leadSlices} />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No leads to score yet.</div>
          )}
        </Card>
      </div>

      {/* ── Hot leads ────────────────────────────────────────────────────── */}
      <Card className="p-8 bg-card border border-border-light rounded-2xl">
        <SectionTitle className="mb-6">Hot Leads (score 80+)</SectionTitle>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-surface-elevated" />
        ) : hotLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {hotLeads.map((lead, idx) => (
                  <tr key={lead.id ?? `${lead.name}-${idx}`} className="border-b border-border-light">
                    <td className="py-3 pr-4 font-medium text-foreground">{lead.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{lead.company ?? '—'}</td>
                    <td className="py-3 pr-4 text-muted-foreground capitalize">{lead.status ?? '—'}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-success">{lead.score ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No leads currently score 80 or above.
          </div>
        )}
      </Card>
    </div>
  );
}
