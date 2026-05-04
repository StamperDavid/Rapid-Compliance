'use client';

/**
 * InsightsListSection
 *
 * Renders the "Jasper's Insights" section inside the JasperOnLoginPopup.
 * Each card surfaces one `Insight` with three actions:
 *
 *   1. "Run this mission"  → POST /api/jasper/insights/{id}/run-as-mission
 *      → on success navigate to /mission-control?mission={missionId} and
 *      close the popup so the operator lands directly on the new mission.
 *   2. "Dismiss"           → POST /api/jasper/insights/{id}/dismiss
 *      Two-step destructive (5s arm + Cancel button) per project rule.
 *   3. "Maybe later"       → just closes the popup; no server call.
 *
 * Sort order: high-urgency cards first, then medium, then low; within a
 * bucket the more-recently-generated insights come first.
 *
 * Design tokens only — `bg-card`, `text-foreground`, `border-border-strong`,
 * `bg-error/10`, `bg-warning/10`. Never raw hex or `var(--color-...)`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, Rocket, Sparkles, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { Insight } from '@/types/jasper-insights';

interface InsightsListSectionProps {
  insights: Insight[];
  /** Called when an insight is removed (run/dismissed) so the parent can sync. */
  onInsightRemoved?: (id: string) => void;
  /** Closes the parent popup (used by "Maybe later" + run-as-mission success). */
  onClosePopup: () => void;
}

const URGENCY_RANK: Record<Insight['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const URGENCY_PILL: Record<Insight['urgency'], { label: string; classes: string }> = {
  high: { label: 'High', classes: 'bg-error/10 text-error border border-error/30' },
  medium: { label: 'Medium', classes: 'bg-warning/10 text-warning border border-warning/30' },
  low: { label: 'Low', classes: 'bg-muted text-muted-foreground border border-border' },
};

const ARM_TIMEOUT_MS = 5000;

export function InsightsListSection({
  insights,
  onInsightRemoved,
  onClosePopup,
}: InsightsListSectionProps) {
  const sorted = useMemo(
    () =>
      [...insights].sort((a, b) => {
        const rankDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return (b.generatedAt ?? '').localeCompare(a.generatedAt ?? '');
      }),
    [insights],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-muted-foreground mb-2" aria-hidden />
        <CardTitle>Nothing pressing today</CardTitle>
        <SectionDescription className="mt-1">
          Jasper has no new recommendations right now. Check back tomorrow.
        </SectionDescription>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onInsightRemoved={onInsightRemoved}
          onClosePopup={onClosePopup}
        />
      ))}
    </ul>
  );
}

interface InsightCardProps {
  insight: Insight;
  onInsightRemoved?: (id: string) => void;
  onClosePopup: () => void;
}

function InsightCard({ insight, onInsightRemoved, onClosePopup }: InsightCardProps) {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissArmed, setDismissArmed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-disarm the dismiss confirmation after ARM_TIMEOUT_MS.
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dismissArmed) {
      armTimerRef.current = setTimeout(() => setDismissArmed(false), ARM_TIMEOUT_MS);
    }
    return () => {
      if (armTimerRef.current !== null) {
        clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
    };
  }, [dismissArmed]);

  const fadeAndRemove = () => {
    setHidden(true);
    window.setTimeout(() => {
      onInsightRemoved?.(insight.id);
    }, 280);
  };

  const handleRunMission = async () => {
    if (running) {
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/jasper/insights/${encodeURIComponent(insight.id)}/run-as-mission`,
        { method: 'POST' },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        missionId?: string;
        error?: string;
      };
      if (!res.ok || data.success !== true || typeof data.missionId !== 'string' || data.missionId === '') {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      onInsightRemoved?.(insight.id);
      onClosePopup();
      router.push(`/mission-control?mission=${encodeURIComponent(data.missionId)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start mission';
      setError(msg);
      logger.error(
        '[InsightsListSection] run-as-mission failed',
        err instanceof Error ? err : new Error(msg),
      );
      setRunning(false);
    }
  };

  const handleDismissClick = async () => {
    if (dismissing) {
      return;
    }
    if (!dismissArmed) {
      setDismissArmed(true);
      return;
    }
    // Armed second click → fire.
    setDismissing(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/jasper/insights/${encodeURIComponent(insight.id)}/dismiss`,
        { method: 'POST' },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || data.success !== true) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      fadeAndRemove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not dismiss insight';
      setError(msg);
      logger.error(
        '[InsightsListSection] dismiss failed',
        err instanceof Error ? err : new Error(msg),
      );
      setDismissing(false);
      setDismissArmed(false);
    }
  };

  const handleMaybeLater = () => {
    onClosePopup();
  };

  const pill = URGENCY_PILL[insight.urgency];

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.li
          data-insight-id={insight.id}
          data-urgency={insight.urgency}
          data-category={insight.category}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-border-strong bg-card text-card-foreground p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="leading-snug">{insight.title}</CardTitle>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${pill.classes}`}
              aria-label={`Urgency: ${pill.label}`}
            >
              {pill.label}
            </span>
          </div>

          <SectionDescription className="mt-2 text-foreground/90">
            {insight.summary}
          </SectionDescription>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={`insight-why-${insight.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
            Why?
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id={`insight-why-${insight.id}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ul className="mt-2 space-y-1 pl-4 list-disc text-sm text-muted-foreground">
                  {insight.signalsSeen.length === 0 ? (
                    <li className="list-none">No signals recorded.</li>
                  ) : (
                    insight.signalsSeen.map((signal, idx) => <li key={idx}>{signal}</li>)
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {error !== null && (
            <p className="mt-3 text-xs text-error" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void handleRunMission();
              }}
              disabled={running || dismissing}
              className="gap-1.5"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Rocket className="h-3.5 w-3.5" aria-hidden />
              )}
              {running ? 'Starting…' : 'Run this mission'}
            </Button>

            {dismissArmed ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void handleDismissClick();
                  }}
                  disabled={dismissing}
                >
                  {dismissing ? 'Dismissing…' : 'Click again to confirm'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDismissArmed(false)}
                  disabled={dismissing}
                  aria-label="Cancel dismiss"
                >
                  <XIcon className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleDismissClick();
                }}
                disabled={running}
              >
                Dismiss
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleMaybeLater}
              disabled={running || dismissing}
            >
              Maybe later
            </Button>

            <Caption className="ml-auto" aria-hidden>
              {insight.category}
            </Caption>
          </div>
        </motion.li>
      )}
    </AnimatePresence>
  );
}

export default InsightsListSection;
