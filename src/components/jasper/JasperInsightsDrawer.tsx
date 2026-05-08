'use client';

/**
 * JasperInsightsDrawer
 *
 * Slide-out drawer from the right side of the viewport that surfaces
 * Jasper's proactive recommendations for "what's worth doing today."
 *
 * - Width 480px desktop, full-screen on mobile.
 * - Header: title + Refresh + Close.
 * - Body: scrollable list of JasperInsightCard.
 * - Footer: "Pick what to focus on" (scrolls to highest-urgency card)
 *           + "Don't show again today" (writes localStorage snooze flag).
 *
 * Auto-open is handled by the consumer (DashboardLayout) — this component
 * is a controlled UI surface only.
 *
 * Design tokens only — `bg-card`, `text-foreground`, `border-border-strong`,
 * etc. Never raw hex or `var(--color-...)`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, X as XIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { JasperInsight } from '@/types/jasper-insights';
import { JasperInsightCard } from './JasperInsightCard';

export const JASPER_INSIGHTS_SNOOZE_KEY = 'jasper_insights_snoozed_until';

interface InsightsListResponse {
  success?: boolean;
  insights?: JasperInsight[];
  error?: string;
}

interface InsightsGenerateResponse {
  success?: boolean;
  generated?: number;
  insights?: JasperInsight[];
  error?: string;
}

interface JasperInsightsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Insights pre-loaded by the parent (e.g., dashboard layout's auto-open check). */
  initialInsights?: JasperInsight[];
}

const URGENCY_RANK: Record<JasperInsight['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sort insights so high-urgency items float to the top, then by generatedAt
 * (most recent first) within the same urgency bucket.
 */
function sortInsights(insights: JasperInsight[]): JasperInsight[] {
  return [...insights]
    .filter((i) => i.dismissedAt === null)
    .sort((a, b) => {
      const rankDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (rankDiff !== 0) {return rankDiff;}
      return (b.generatedAt ?? '').localeCompare(a.generatedAt ?? '');
    });
}

/**
 * Snooze the auto-open behavior until the next calendar day (local time).
 * Stored as ISO date in localStorage; consumed by the dashboard layout.
 */
function setSnoozeUntilTomorrow(): void {
  if (typeof window === 'undefined') {return;}
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  try {
    window.localStorage.setItem(JASPER_INSIGHTS_SNOOZE_KEY, tomorrow.toISOString());
  } catch (err: unknown) {
    logger.warn('[JasperInsightsDrawer] could not write snooze flag');
    void err;
  }
}

function clearSnooze(): void {
  if (typeof window === 'undefined') {return;}
  try {
    window.localStorage.removeItem(JASPER_INSIGHTS_SNOOZE_KEY);
  } catch (err: unknown) {
    void err;
  }
}

export function JasperInsightsDrawer({
  open,
  onClose,
  initialInsights,
}: JasperInsightsDrawerProps) {
  const authFetch = useAuthFetch();
  const [insights, setInsights] = useState<JasperInsight[]>(initialInsights ?? []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snoozeChecked, setSnoozeChecked] = useState(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // If the parent supplies fresh insights (e.g., re-open with new list), sync them in.
  useEffect(() => {
    if (initialInsights && initialInsights.length > 0) {
      setInsights(initialInsights);
    }
  }, [initialInsights]);

  // First open: pull the latest insights from the API so the drawer is never stale.
  useEffect(() => {
    if (!open) {return;}
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch('/api/jasper/insights');
        const data = (await res.json().catch(() => ({}))) as InsightsListResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? `Failed (${res.status})`);
        }
        if (!cancelled) {
          setInsights(data.insights ?? []);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not load insights';
        if (!cancelled) {setError(msg);}
        logger.error('[JasperInsightsDrawer] load failed', err instanceof Error ? err : new Error(msg));
      } finally {
        if (!cancelled) {setLoading(false);}
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, authFetch]);

  const sorted = useMemo(() => sortInsights(insights), [insights]);

  const handleRemove = useCallback((insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) {return;}
    setRefreshing(true);
    setError(null);
    try {
      const res = await authFetch('/api/jasper/insights/generate', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as InsightsGenerateResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setInsights(data.insights ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate insights';
      setError(msg);
      logger.error('[JasperInsightsDrawer] refresh failed', err instanceof Error ? err : new Error(msg));
    } finally {
      setRefreshing(false);
    }
  }, [authFetch, refreshing]);

  const handleFocusTopUrgency = useCallback(() => {
    if (sorted.length === 0) {return;}
    const topId = sorted[0].id;
    const root = listContainerRef.current;
    if (!root) {return;}
    const target = root.querySelector<HTMLElement>(`[data-insight-id="${topId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    }
  }, [sorted]);

  const handleSnoozeChange = (checked: boolean) => {
    setSnoozeChecked(checked);
    if (checked) {
      setSnoozeUntilTomorrow();
    } else {
      clearSnooze();
    }
  };

  // Close on Escape.
  useEffect(() => {
    if (!open) {return;}
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {onClose();}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — click to close. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-background/40 backdrop-blur-sm"
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Jasper's Insights for Today"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-[60] flex flex-col w-full md:w-[480px] bg-card text-card-foreground border-l border-border-strong shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-strong">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <SectionTitle className="truncate">Jasper&apos;s Insights for Today</SectionTitle>
                  <SectionDescription className="text-xs">
                    Proactive recommendations from your AI partner
                  </SectionDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { void handleRefresh(); }}
                  disabled={refreshing}
                  aria-label="Refresh insights"
                  className="gap-1.5"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  aria-label="Close insights"
                >
                  <XIcon className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </header>

            {/* Body */}
            <div
              ref={listContainerRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-background"
            >
              {error !== null && (
                <div
                  role="alert"
                  className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
                >
                  {error}
                </div>
              )}

              {loading && insights.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
                  Loading insights…
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-muted-foreground mb-2" aria-hidden />
                  <SectionTitle className="text-base">All clear for now</SectionTitle>
                  <SectionDescription className="mt-1">
                    No new recommendations. Click <strong>Refresh</strong> to ask Jasper to scan again.
                  </SectionDescription>
                </div>
              ) : (
                sorted.map((insight) => (
                  <JasperInsightCard
                    key={insight.id}
                    insight={insight}
                    onRemove={handleRemove}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <footer className="border-t border-border-strong bg-card px-5 py-3 space-y-2">
              <Button
                type="button"
                onClick={handleFocusTopUrgency}
                disabled={sorted.length === 0}
                className="w-full"
              >
                Pick what to focus on
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={snoozeChecked}
                  onChange={(e) => handleSnoozeChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Don&apos;t show again today
              </label>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default JasperInsightsDrawer;
