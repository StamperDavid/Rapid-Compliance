'use client';

/**
 * Marketing Budget — operator-controlled allocation page.
 *
 * Surfaces BUDGET_STRATEGIST recommendations alongside a manual editing
 * surface so the operator can override any number before acting. Each
 * recommendation is acted on by copying its mission prompt into Jasper
 * (manual platforms) or — once item #5 ships — auto-applied via the
 * platform's budget-change API.
 *
 * Honest scope (May 9, 2026):
 *   - Operator MANUALLY enters per-platform spend + conversion data.
 *     CRM source attribution is item #6 (not yet wired).
 *   - "Apply" for manual-mission platforms COPIES the mission prompt
 *     to clipboard. Operator pastes into Jasper themselves.
 *   - Auto-apply for platforms WITH a budget API (Google Ads / Meta Ads)
 *     is item #5 — surfaced as a "not yet wired" callout, never silently
 *     no-ops.
 *   - No cron refresh — operator clicks Analyze on demand. Item #4.
 */

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  CardTitle,
  Caption,
} from '@/components/ui/typography';
import {
  Plus,
  Trash2,
  Copy,
  AlertTriangle,
  Info,
  ArrowUp,
  ArrowDown,
  Minus,
  PauseCircle,
  Loader2,
  Sparkles,
  Database,
} from 'lucide-react';
import type {
  BudgetStrategistResult,
  BudgetRecommendation,
  PlatformSpendSnapshot,
  ConversionSource,
  RecommendationActionType,
  RecommendationConfidence,
} from '@/types/budget-strategist';

// ============================================================================
// LOCAL STATE TYPES
// ============================================================================

interface PlatformRow extends PlatformSpendSnapshot {
  rowId: string;
}

const CONVERSION_SOURCES: { value: ConversionSource; label: string; help: string }[] = [
  { value: 'crm', label: 'CRM (UTM-attributed)', help: 'Highest trust — UTM tags hit the CRM source field at form submit.' },
  { value: 'ga4', label: 'GA4', help: 'UTM-tagged links via Google Analytics — fallback when CRM source isn\'t wired yet.' },
  { value: 'platform_self_reported', label: 'Platform self-reported', help: 'Sanity check only — discount when this differs sharply from CRM/GA4.' },
];

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];

const DEFAULT_PLATFORMS: PlatformRow[] = [
  { rowId: 'r1', platform: 'google_ads', displayName: 'Google Ads', currentSpendUsd: 0, conversions: 0, conversionSource: 'crm', requiresManualBudgetChange: false },
  { rowId: 'r2', platform: 'meta_ads', displayName: 'Meta Ads', currentSpendUsd: 0, conversions: 0, conversionSource: 'crm', requiresManualBudgetChange: false },
  { rowId: 'r3', platform: 'google_lsa', displayName: 'Google LSA', currentSpendUsd: 0, conversions: 0, conversionSource: 'crm', requiresManualBudgetChange: true },
  { rowId: 'r4', platform: 'seo_retainer', displayName: 'SEO Retainer', currentSpendUsd: 0, conversions: 0, conversionSource: 'crm', requiresManualBudgetChange: true },
];

let rowIdSeq = 100;
function nextRowId(): string {
  rowIdSeq += 1;
  return `r${rowIdSeq}`;
}

// ============================================================================
// PAGE
// ============================================================================

interface PullFromCrmSummary {
  totalLeadsInWindow: number;
  leadsWithSource: number;
  rowsUpdated: number;
  unmatchedPlatforms: Array<{ platform: string; count: number }>;
}

export default function MarketingBudgetPage() {
  const toast = useToast();
  const [totalBudget, setTotalBudget] = useState<string>('5000');
  const [windowDays, setWindowDays] = useState<number>(30);
  const [platforms, setPlatforms] = useState<PlatformRow[]>(DEFAULT_PLATFORMS);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BudgetStrategistResult | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
  const [pullingFromCrm, setPullingFromCrm] = useState(false);
  const [pullSummary, setPullSummary] = useState<PullFromCrmSummary | null>(null);

  const updatePlatformField = <K extends keyof PlatformSpendSnapshot>(
    rowId: string,
    field: K,
    value: PlatformSpendSnapshot[K],
  ) => {
    setPlatforms((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)),
    );
  };

  const addPlatformRow = () => {
    setPlatforms((rows) => [
      ...rows,
      {
        rowId: nextRowId(),
        platform: '',
        displayName: '',
        currentSpendUsd: 0,
        conversions: 0,
        conversionSource: 'crm',
        requiresManualBudgetChange: false,
      },
    ]);
  };

  const removePlatformRow = (rowId: string) => {
    setPlatforms((rows) => rows.filter((r) => r.rowId !== rowId));
  };

  const handlePullFromCrm = async () => {
    setErrorMessage(null);
    setPullSummary(null);

    const token = await auth?.currentUser?.getIdToken();
    if (!token) {
      setErrorMessage('Not authenticated. Refresh the page and sign in again.');
      return;
    }

    setPullingFromCrm(true);
    try {
      const response = await fetch(
        `/api/marketing/budget/conversions?windowDays=${windowDays}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const raw: unknown = await response.json();
      const data = raw as {
        success?: boolean;
        aggregation?: {
          totalLeadsInWindow: number;
          leadsWithSource: number;
          byPlatform: Array<{ platform: string; count: number; rawSources: string[] }>;
        };
        error?: string;
      };

      if (!response.ok || data.success !== true || !data.aggregation) {
        setErrorMessage(data.error ?? `Pull from CRM failed (HTTP ${response.status}).`);
        return;
      }

      const byPlatformMap = new Map(
        data.aggregation.byPlatform.map((p) => [p.platform.toLowerCase(), p.count]),
      );

      let rowsUpdated = 0;
      setPlatforms((rows) =>
        rows.map((row) => {
          const key = row.platform.trim().toLowerCase();
          if (!key) {return row;}
          const found = byPlatformMap.get(key);
          if (typeof found === 'number') {
            rowsUpdated++;
            return { ...row, conversions: found, conversionSource: 'crm' };
          }
          return row;
        }),
      );

      const matchedPlatformKeys = new Set(
        platforms.map((r) => r.platform.trim().toLowerCase()).filter(Boolean),
      );
      const unmatched = data.aggregation.byPlatform
        .filter((p) => !matchedPlatformKeys.has(p.platform.toLowerCase()))
        .filter((p) => p.platform !== 'direct')
        .map((p) => ({ platform: p.platform, count: p.count }));

      setPullSummary({
        totalLeadsInWindow: data.aggregation.totalLeadsInWindow,
        leadsWithSource: data.aggregation.leadsWithSource,
        rowsUpdated,
        unmatchedPlatforms: unmatched,
      });

      toast.success(
        rowsUpdated > 0
          ? `Updated ${rowsUpdated} platform${rowsUpdated === 1 ? '' : 's'} with CRM-attributed conversions.`
          : 'Pull succeeded — no platform keys matched. Check the unmatched list below.',
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error during pull.');
    } finally {
      setPullingFromCrm(false);
    }
  };

  const handleAnalyze = async () => {
    setErrorMessage(null);

    const totalBudgetUsd = Number.parseFloat(totalBudget);
    if (!Number.isFinite(totalBudgetUsd) || totalBudgetUsd <= 0) {
      setErrorMessage('Total budget must be a positive number.');
      return;
    }

    const cleanRows = platforms
      .map((r) => ({
        platform: r.platform.trim(),
        displayName: r.displayName.trim(),
        currentSpendUsd: r.currentSpendUsd,
        conversions: r.conversions,
        conversionSource: r.conversionSource,
        platformReportedConversions: r.platformReportedConversions,
        requiresManualBudgetChange: r.requiresManualBudgetChange ?? false,
      }))
      .filter((r) => r.platform && r.displayName);

    if (cleanRows.length === 0) {
      setErrorMessage('Add at least one platform with a key and display name.');
      return;
    }

    const token = await auth?.currentUser?.getIdToken();
    if (!token) {
      setErrorMessage('Not authenticated. Refresh the page and sign in again.');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch('/api/marketing/budget/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          totalBudgetUsd,
          windowDays,
          platforms: cleanRows,
        }),
      });

      const raw: unknown = await response.json();
      const data = raw as { success?: boolean; result?: BudgetStrategistResult; snapshotId?: string; error?: string };

      if (!response.ok || data.success !== true || !data.result) {
        setErrorMessage(data.error ?? `Analyze failed (HTTP ${response.status}).`);
        return;
      }

      setResult(data.result);
      setSnapshotId(data.snapshotId ?? null);
      setEditedAmounts({});
      toast.success('Budget analysis ready.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error during analyze.';
      setErrorMessage(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const editedSum = result
    ? result.recommendations.reduce((acc, rec) => {
        const edited = editedAmounts[rec.platform];
        const value = edited === undefined || edited === '' ? rec.recommendedSpendUsd : Number.parseFloat(edited);
        return acc + (Number.isFinite(value) ? value : rec.recommendedSpendUsd);
      }, 0)
    : 0;

  const totalBudgetParsed = Number.parseFloat(totalBudget);
  const editedDelta = Number.isFinite(totalBudgetParsed) ? editedSum - totalBudgetParsed : 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <PageTitle>Marketing Budget</PageTitle>
        <SectionDescription className="mt-1">
          Plan, allocate, and adjust marketing spend across every connected platform.
          BUDGET_STRATEGIST recommends; you decide what to apply.
        </SectionDescription>
      </div>

      {/* Top row — setup + scope callouts */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Setup card */}
        <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-5">
          <CardTitle>Setup</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="total-budget" className="text-sm font-medium text-foreground">
                Total budget (USD)
              </label>
              <Input
                id="total-budget"
                type="number"
                inputMode="decimal"
                min="0"
                step="100"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="5000"
              />
              <Caption>What you want allocated across all platforms for the upcoming window.</Caption>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="window-days" className="text-sm font-medium text-foreground">
                Window (days)
              </label>
              <select
                id="window-days"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {WINDOW_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
              <Caption>Length of the spend snapshot below — recommendations apply to the same forward window.</Caption>
            </div>
          </div>
        </div>

        {/* Scope / shortcut callouts (loud, per standing rule) */}
        <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-info" />
            <CardTitle>What&apos;s not yet wired</CardTitle>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Auto-apply</span> — for Google Ads
              and Meta Ads, budget shifts will happen via API once the integrations ship.
              Until then, every recommendation copies as a Jasper mission prompt.
            </li>
            <li>
              <span className="font-medium text-foreground">Spend auto-pull</span> — spend
              numbers from Google Ads / Meta Ads still require manual entry until those
              integrations ship. Conversions can already be pulled from the CRM via the
              button below.
            </li>
            <li>
              <span className="font-medium text-foreground">Hourly refresh</span> — no cron
              yet. Click <span className="font-medium text-foreground">Analyze</span> to refresh
              recommendations on demand.
            </li>
          </ul>
        </div>
      </div>

      {/* Platforms table */}
      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Platform spend snapshot</CardTitle>
            <Caption>Enter what you spent and how many conversions you saw over the {windowDays}-day window.</Caption>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handlePullFromCrm(); }}
              disabled={pullingFromCrm}
              title="Populate conversion counts from CRM leads attributed via UTM capture."
            >
              {pullingFromCrm ? (
                <><Loader2 size={14} className="mr-1.5 animate-spin" /> Pulling…</>
              ) : (
                <><Database size={14} className="mr-1.5" /> Pull from CRM</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={addPlatformRow}>
              <Plus size={14} className="mr-1.5" /> Add platform
            </Button>
          </div>
        </div>

        {pullSummary && (
          <div className="rounded-md border border-info/40 bg-info/5 p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-info" />
              <div className="flex-1">
                <div className="font-medium text-foreground">
                  Pulled {pullSummary.leadsWithSource} attributed leads from {pullSummary.totalLeadsInWindow} total in the last {windowDays} days.
                </div>
                <Caption>
                  {pullSummary.rowsUpdated} platform row{pullSummary.rowsUpdated === 1 ? '' : 's'} updated with CRM-attributed conversion counts.
                </Caption>
              </div>
            </div>
            {pullSummary.unmatchedPlatforms.length > 0 && (
              <div className="pl-6">
                <Caption className="text-foreground">
                  Unmatched platform sources from the CRM (add rows below to include them):
                </Caption>
                <ul className="mt-1 space-y-0.5">
                  {pullSummary.unmatchedPlatforms.map((p) => (
                    <li key={p.platform} className="text-xs text-muted-foreground">
                      <span className="font-mono">{p.platform}</span> — {p.count} conversion{p.count === 1 ? '' : 's'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border-strong">
                <th className="font-medium py-2 pr-3">Platform key</th>
                <th className="font-medium py-2 pr-3">Display name</th>
                <th className="font-medium py-2 pr-3 text-right">Spend ($)</th>
                <th className="font-medium py-2 pr-3 text-right">Conversions</th>
                <th className="font-medium py-2 pr-3">Source</th>
                <th className="font-medium py-2 pr-3">Manual?</th>
                <th className="font-medium py-2 pr-0 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((row) => (
                <tr key={row.rowId} className="border-b border-border-light last:border-b-0">
                  <td className="py-2 pr-3">
                    <Input
                      value={row.platform}
                      onChange={(e) => updatePlatformField(row.rowId, 'platform', e.target.value)}
                      placeholder="google_ads"
                      className="h-9"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      value={row.displayName}
                      onChange={(e) => updatePlatformField(row.rowId, 'displayName', e.target.value)}
                      placeholder="Google Ads"
                      className="h-9"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="50"
                      value={row.currentSpendUsd === 0 ? '' : String(row.currentSpendUsd)}
                      onChange={(e) =>
                        updatePlatformField(
                          row.rowId,
                          'currentSpendUsd',
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0"
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={row.conversions === 0 ? '' : String(row.conversions)}
                      onChange={(e) =>
                        updatePlatformField(
                          row.rowId,
                          'conversions',
                          Number.parseInt(e.target.value, 10) || 0,
                        )
                      }
                      placeholder="0"
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={row.conversionSource}
                      onChange={(e) =>
                        updatePlatformField(
                          row.rowId,
                          'conversionSource',
                          e.target.value as ConversionSource,
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CONVERSION_SOURCES.map((s) => (
                        <option key={s.value} value={s.value} title={s.help}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.requiresManualBudgetChange ?? false}
                        onChange={(e) =>
                          updatePlatformField(
                            row.rowId,
                            'requiresManualBudgetChange',
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4"
                      />
                      <Caption>Manual</Caption>
                    </label>
                  </td>
                  <td className="py-2 pr-0 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlatformRow(row.rowId)}
                      aria-label={`Remove ${row.displayName || row.platform || 'row'}`}
                      disabled={platforms.length <= 1}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <Caption>
            {platforms.filter((p) => p.platform && p.displayName).length} platform(s) ready
            to analyze.
          </Caption>
          <Button onClick={() => { void handleAnalyze(); }} disabled={analyzing}>
            {analyzing ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles size={14} className="mr-1.5" /> {result ? 'Re-analyze' : 'Analyze'}</>
            )}
          </Button>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Result section */}
      {result && (
        <ResultPanel
          result={result}
          snapshotId={snapshotId}
          editedAmounts={editedAmounts}
          setEditedAmounts={setEditedAmounts}
          editedSum={editedSum}
          editedDelta={editedDelta}
          totalBudget={totalBudgetParsed}
          onCopyMissionPrompt={(rec, finalAmount) => {
            const prompt = composeMissionPrompt(rec, finalAmount, windowDays);
            void navigator.clipboard.writeText(prompt).then(
              () =>
                toast.success(
                  `Mission prompt for ${rec.displayName} copied — paste into Jasper to start.`,
                ),
              () => toast.error('Could not copy to clipboard. Select the prompt text manually.'),
            );
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// RESULT PANEL
// ============================================================================

interface ResultPanelProps {
  result: BudgetStrategistResult;
  snapshotId: string | null;
  editedAmounts: Record<string, string>;
  setEditedAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editedSum: number;
  editedDelta: number;
  totalBudget: number;
  onCopyMissionPrompt: (rec: BudgetRecommendation, finalAmount: number) => void;
}

function ResultPanel({
  result,
  snapshotId,
  editedAmounts,
  setEditedAmounts,
  editedSum,
  editedDelta,
  totalBudget,
  onCopyMissionPrompt,
}: ResultPanelProps) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <SectionTitle as="h2">Recommendation summary</SectionTitle>
        </div>

        {result.insufficientData && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-900/20 p-3 text-sm text-yellow-100">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Recommendations are exploratory.</div>
              <div className="mt-0.5">
                {result.insufficientDataMessage ??
                  'Total attributed conversions are below the confidence threshold. Treat output as a starting point until more conversion data accumulates.'}
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-foreground leading-relaxed">{result.summaryRationale}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          <SummaryStat label="Total budget" value={`$${totalBudget.toLocaleString()}`} />
          <SummaryStat
            label="Allocated (with edits)"
            value={`$${editedSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <SummaryStat
            label="Diff vs. budget"
            value={`${editedDelta >= 0 ? '+' : ''}$${editedDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            tone={Math.abs(editedDelta) <= 1 ? 'ok' : 'warn'}
          />
        </div>

        {Math.abs(editedDelta) > 1 && (
          <Caption>
            Your manual edits no longer sum to the total budget. Either adjust amounts or
            change the total budget at the top of the page before applying.
          </Caption>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        {result.recommendations.map((rec) => (
          <RecommendationCard
            key={rec.platform}
            rec={rec}
            snapshotId={snapshotId}
            editedValue={editedAmounts[rec.platform] ?? ''}
            onEditChange={(value) =>
              setEditedAmounts((prev) => ({ ...prev, [rec.platform]: value }))
            }
            onResetEdit={() =>
              setEditedAmounts((prev) => {
                const next = { ...prev };
                delete next[rec.platform];
                return next;
              })
            }
            onCopyMissionPrompt={onCopyMissionPrompt}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  const toneClass =
    tone === 'warn'
      ? 'text-yellow-300'
      : tone === 'ok'
        ? 'text-green-400'
        : 'text-foreground';
  return (
    <div className="rounded-md border border-border-light bg-surface-main p-3">
      <Caption className="uppercase tracking-wide">{label}</Caption>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// RECOMMENDATION CARD
// ============================================================================

interface RecommendationCardProps {
  rec: BudgetRecommendation;
  snapshotId: string | null;
  editedValue: string;
  onEditChange: (value: string) => void;
  onResetEdit: () => void;
  onCopyMissionPrompt: (rec: BudgetRecommendation, finalAmount: number) => void;
}

function RecommendationCard({
  rec,
  snapshotId,
  editedValue,
  onEditChange,
  onResetEdit,
  onCopyMissionPrompt,
}: RecommendationCardProps) {
  const editedAmount = editedValue === '' ? rec.recommendedSpendUsd : Number.parseFloat(editedValue);
  const finalAmount = Number.isFinite(editedAmount) ? editedAmount : rec.recommendedSpendUsd;
  const isEdited = editedValue !== '' && Math.abs(finalAmount - rec.recommendedSpendUsd) > 0.5;
  const finalDelta = finalAmount - rec.currentSpendUsd;

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ActionBadge action={rec.actionType} />
        <CardTitle className="flex-1">{rec.displayName}</CardTitle>
        <ConfidenceBadge confidence={rec.confidence} />
      </div>

      {/* Numbers row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-3">
        <NumberBlock label="Current spend" value={`$${rec.currentSpendUsd.toLocaleString()}`} />

        <ArrowDivider />

        <div className="space-y-1.5">
          <Caption className="uppercase tracking-wide">Recommended (editable)</Caption>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="50"
            value={editedValue === '' ? String(rec.recommendedSpendUsd) : editedValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="h-10 text-base font-semibold"
          />
          {isEdited && (
            <button
              type="button"
              onClick={onResetEdit}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Reset to AI suggestion (${rec.recommendedSpendUsd.toLocaleString()})
            </button>
          )}
        </div>

        <ArrowDivider />

        <NumberBlock
          label="Delta"
          value={`${finalDelta >= 0 ? '+' : ''}$${finalDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tone={finalDelta > 0 ? 'positive' : finalDelta < 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Rationale */}
      <p className="text-sm text-muted-foreground leading-relaxed">{rec.rationale}</p>

      {/* Apply path */}
      {rec.requiresManualMissionTask ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Caption>
            This platform doesn&apos;t have a budget API — the change runs as a Jasper mission.
          </Caption>
          <Button
            variant="default"
            size="sm"
            onClick={() => onCopyMissionPrompt(rec, finalAmount)}
          >
            <Copy size={14} className="mr-1.5" /> Copy mission prompt
          </Button>
        </div>
      ) : (
        <TwoStepApplyButton
          rec={rec}
          finalAmount={finalAmount}
          snapshotId={snapshotId}
          onCopyMissionPrompt={onCopyMissionPrompt}
        />
      )}
    </div>
  );
}

// ============================================================================
// TWO-STEP APPLY BUTTON — destructive-actions standing rule
// ============================================================================

interface ApplyApiResult {
  success?: boolean;
  result?: {
    outcome: string;
    summary: string;
    details?: Array<{ leafId: string; leafName: string; previousBudgetUsd: number; newBudgetUsd: number; success: boolean; error?: string }>;
    missionPrompt?: string;
  };
  error?: string;
}

function TwoStepApplyButton({
  rec,
  finalAmount,
  snapshotId,
  onCopyMissionPrompt,
}: {
  rec: BudgetRecommendation;
  finalAmount: number;
  snapshotId: string | null;
  onCopyMissionPrompt: (rec: BudgetRecommendation, finalAmount: number) => void;
}) {
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState<ApplyApiResult['result'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (disarmTimerRef.current) {clearTimeout(disarmTimerRef.current);}
    };
  }, []);

  const arm = () => {
    setArmed(true);
    setErrorMessage(null);
    if (disarmTimerRef.current) {clearTimeout(disarmTimerRef.current);}
    disarmTimerRef.current = setTimeout(() => setArmed(false), 5000);
  };

  const cancel = () => {
    setArmed(false);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  };

  const fire = async () => {
    setArmed(false);
    if (disarmTimerRef.current) {clearTimeout(disarmTimerRef.current);}
    setApplying(true);
    setErrorMessage(null);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setErrorMessage('Not authenticated. Refresh and sign in again.');
        return;
      }
      const res = await fetch('/api/marketing/budget/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          platform: rec.platform,
          confirmed: true,
          ...(snapshotId ? { snapshotId } : {}),
          ...(Math.abs(finalAmount - rec.recommendedSpendUsd) > 0.5
            ? { overrideSpendUsd: finalAmount }
            : {}),
        }),
      });
      const data = (await res.json()) as ApplyApiResult;
      setOutcome(data.result ?? null);
      if (!res.ok || data.success !== true) {
        setErrorMessage(data.error ?? data.result?.summary ?? `Apply failed (HTTP ${res.status})`);
        // If apply fell through to manual path (e.g., "not configured"), offer copy prompt
        if (data.result?.outcome === 'manual_mission_required' && data.result.missionPrompt) {
          toast.info('Auto-apply not available — use Copy mission prompt to handle manually.');
        }
        return;
      }
      toast.success(data.result?.summary ?? 'Budget applied.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply request failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Caption>
          Auto-apply moves money on {rec.displayName}. Requires two clicks per the
          destructive-action rule.
        </Caption>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopyMissionPrompt(rec, finalAmount)}
            disabled={applying}
          >
            <Copy size={14} className="mr-1.5" /> Copy mission prompt
          </Button>
          {!armed ? (
            <Button
              variant="default"
              size="sm"
              onClick={arm}
              disabled={applying}
            >
              {applying ? (
                <><Loader2 size={14} className="mr-1.5 animate-spin" /> Applying…</>
              ) : (
                <>Apply ${finalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
              )}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void fire()}
                className="bg-red-600 hover:bg-red-700"
              >
                Click again to apply
              </Button>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div>{errorMessage}</div>
            {outcome?.outcome === 'not_configured' && (
              <Caption className="mt-1">
                Open{' '}
                <a href="/settings/integrations?category=marketing-ads" className="underline">
                  Settings → Integrations → Marketing Ads
                </a>
                {' '}to connect this platform.
              </Caption>
            )}
          </div>
        </div>
      )}

      {outcome?.outcome === 'auto_applied' && outcome.details && outcome.details.length > 0 && (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 space-y-1.5 text-sm">
          <div className="text-success font-medium">{outcome.summary}</div>
          {outcome.details.map((d) => (
            <div key={d.leafId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{d.leafName}</span>
              <span className="text-muted-foreground tabular-nums">
                ${d.previousBudgetUsd.toFixed(2)} → ${d.newBudgetUsd.toFixed(2)}/day
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-400'
      : tone === 'negative'
        ? 'text-red-400'
        : 'text-foreground';
  return (
    <div className="space-y-1.5">
      <Caption className="uppercase tracking-wide">{label}</Caption>
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ArrowDivider() {
  return (
    <div className="hidden md:block text-muted-foreground/60 text-base self-center">→</div>
  );
}

function ActionBadge({ action }: { action: RecommendationActionType }) {
  const meta: Record<
    RecommendationActionType,
    { label: string; icon: React.ReactNode; classes: string }
  > = {
    increase: {
      label: 'Increase',
      icon: <ArrowUp size={12} />,
      classes: 'bg-green-900/40 text-green-300 border-green-500/40',
    },
    decrease: {
      label: 'Decrease',
      icon: <ArrowDown size={12} />,
      classes: 'bg-orange-900/40 text-orange-300 border-orange-500/40',
    },
    hold: {
      label: 'Hold',
      icon: <Minus size={12} />,
      classes: 'bg-blue-900/30 text-blue-300 border-blue-500/40',
    },
    pause: {
      label: 'Pause',
      icon: <PauseCircle size={12} />,
      classes: 'bg-red-900/40 text-red-300 border-red-500/40',
    },
  };
  const m = meta[action];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.classes}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: RecommendationConfidence }) {
  const classes: Record<RecommendationConfidence, string> = {
    high: 'bg-green-900/30 text-green-300 border-green-500/30',
    medium: 'bg-yellow-900/30 text-yellow-200 border-yellow-500/30',
    low: 'bg-red-900/30 text-red-300 border-red-500/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${classes[confidence]}`}
    >
      {confidence} confidence
    </span>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function composeMissionPrompt(
  rec: BudgetRecommendation,
  finalAmount: number,
  windowDays: number,
): string {
  const baseFromAgent = rec.manualMissionPrompt?.trim();
  if (baseFromAgent && Math.abs(finalAmount - rec.recommendedSpendUsd) <= 0.5) {
    return baseFromAgent;
  }

  const direction = finalAmount > rec.currentSpendUsd ? 'increase' : finalAmount < rec.currentSpendUsd ? 'decrease' : 'hold';
  const magnitude = Math.abs(finalAmount - rec.currentSpendUsd);
  return [
    `Action: ${direction === 'hold' ? 'Hold' : direction === 'increase' ? 'Increase' : 'Decrease'} ${rec.displayName} budget for the next ${windowDays}-day window.`,
    `Current spend: $${rec.currentSpendUsd.toLocaleString()} → Target: $${finalAmount.toLocaleString()} (${direction === 'increase' ? '+' : direction === 'decrease' ? '-' : ''}$${magnitude.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`,
    rec.rationale ? `Rationale: ${rec.rationale}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
