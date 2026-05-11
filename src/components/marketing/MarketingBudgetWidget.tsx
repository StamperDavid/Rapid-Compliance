'use client';

/**
 * Marketing Budget Widget
 *
 * Dashboard tile that surfaces the latest BUDGET_STRATEGIST snapshot. Reads
 * from /api/marketing/budget/latest (which queries the marketingBudgetSnapshots
 * collection sorted by createdAt desc). Renders the top 2 highest-impact
 * recommendations, total allocation, and a click-through to the full
 * /marketing/budget page.
 *
 * The widget does NOT trigger an LLM call. Operator drives analyses from
 * the full page; widget surfaces what's already been computed.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  PauseCircle,
  DollarSign,
  ArrowRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { BudgetRecommendation, BudgetStrategistResult, AnalyzeBudgetRequest, RecommendationActionType } from '@/types/budget-strategist';

interface BudgetSnapshot {
  id: string;
  createdAt: string;
  createdBy: 'operator' | 'cron';
  userId?: string;
  inputs: AnalyzeBudgetRequest;
  result: BudgetStrategistResult;
  modelUsed?: string;
}

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) {return '';}
  const diff = Date.now() - ts;
  if (diff < 60_000) {return 'just now';}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function ActionIcon({ action }: { action: RecommendationActionType }) {
  const common = 'shrink-0';
  switch (action) {
    case 'increase': return <ArrowUp size={14} className={`${common} text-success`} />;
    case 'decrease': return <ArrowDown size={14} className={`${common} text-warning`} />;
    case 'pause': return <PauseCircle size={14} className={`${common} text-error`} />;
    case 'hold':
    default: return <Minus size={14} className={`${common} text-muted-foreground`} />;
  }
}

function topRecommendations(recs: BudgetRecommendation[], n: number): BudgetRecommendation[] {
  return [...recs]
    .sort((a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd))
    .slice(0, n);
}

export default function MarketingBudgetWidget() {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLatest() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) {
          if (!cancelled) {
            setSnapshot(null);
            setLoading(false);
          }
          return;
        }
        const res = await fetch('/api/marketing/budget/latest', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {setErrorMessage(data.error ?? `Failed to load (HTTP ${res.status})`);}
          return;
        }
        const data = (await res.json()) as { success?: boolean; snapshot?: BudgetSnapshot | null };
        if (!cancelled) {
          setSnapshot(data.snapshot ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Network error');
          logger.error(
            'MarketingBudgetWidget fetch failed',
            err instanceof Error ? err : new Error(String(err)),
            { file: 'MarketingBudgetWidget.tsx' },
          );
        }
      } finally {
        if (!cancelled) {setLoading(false);}
      }
    }
    void fetchLatest();
    return () => { cancelled = true; };
  }, []);

  return (
    <Link href="/marketing/budget" className="no-underline">
      <div className="bg-card border border-border-strong rounded-2xl p-6 h-full transition-colors hover:border-border-main">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground"><DollarSign size={16} /></span>
          <h2 className="text-[0.95rem] font-semibold text-foreground m-0">Marketing Budget</h2>
          {snapshot && (
            <span className="ml-auto text-[0.65rem] text-muted-foreground">
              Last analyzed {timeAgo(snapshot.createdAt)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-4 text-xs text-muted-foreground">Loading latest analysis…</div>
        ) : errorMessage ? (
          <div className="mt-4 flex items-start gap-2 text-xs text-error">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : !snapshot ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              No allocations yet. Run your first analysis to see where BUDGET_STRATEGIST
              recommends shifting spend across your platforms.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles size={12} />
              Start analysis
              <ArrowRight size={12} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-[0.65rem] text-muted-foreground mb-1 uppercase tracking-wide">Total budget</p>
                <p className="text-lg font-bold m-0 text-foreground">${snapshot.inputs.totalBudgetUsd.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[0.65rem] text-muted-foreground mb-1 uppercase tracking-wide">Window</p>
                <p className="text-lg font-bold m-0 text-foreground">{snapshot.inputs.windowDays}d</p>
              </div>
            </div>

            {snapshot.result.insufficientData && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[0.7rem] text-warning">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                <span>Recommendations are exploratory — conversion volume is low.</span>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              {topRecommendations(snapshot.result.recommendations, 2).map((rec) => (
                <div
                  key={rec.platform}
                  className="flex items-center gap-2 px-2.5 py-2 bg-surface-main border border-surface-elevated rounded-md"
                >
                  <ActionIcon action={rec.actionType} />
                  <span className="text-[0.8rem] font-medium text-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {rec.displayName}
                  </span>
                  <span
                    className={`text-[0.75rem] font-semibold tabular-nums shrink-0 ${
                      rec.deltaUsd > 0 ? 'text-success' : rec.deltaUsd < 0 ? 'text-warning' : 'text-muted-foreground'
                    }`}
                  >
                    {rec.deltaUsd >= 0 ? '+' : ''}${rec.deltaUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              View full allocation <ArrowRight size={10} />
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
