'use client';

/**
 * JasperInsightCard
 *
 * A single proactive recommendation card surfaced inside the
 * JasperInsightsDrawer. Each card represents one `JasperInsight` returned
 * from `/api/jasper/insights` and exposes three actions:
 *
 *   1. Run this mission   → POST /api/jasper/insights/{id}/run-as-mission
 *      → navigate to /mission-control?mission={missionId}
 *   2. Dismiss            → POST /api/jasper/insights/{id}/dismiss
 *      Two-step destructive (5s arm + Cancel button) per project rule.
 *   3. Snooze for today   → POST /api/jasper/insights/{id}/dismiss?snooze=1
 *      v1 treats snooze + dismiss the same; backend will diverge later.
 *
 * Design tokens only — no raw hex, no `var(--color-...)` strings.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, Rocket, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle, Caption, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { JasperInsight } from '@/types/jasper-insights';

interface JasperInsightCardProps {
  insight: JasperInsight;
  /** Called after the card has been dismissed/snoozed/run-as-mission so the parent can drop it from the list. */
  onRemove: (insightId: string) => void;
}

const URGENCY_PILL: Record<JasperInsight['urgency'], { label: string; classes: string }> = {
  high: {
    label: 'High',
    classes: 'bg-error/15 text-error border border-error/30',
  },
  medium: {
    label: 'Medium',
    classes: 'bg-warning/15 text-warning border border-warning/30',
  },
  low: {
    label: 'Low',
    classes: 'bg-muted text-muted-foreground border border-border',
  },
};

const ARM_TIMEOUT_MS = 5000;

export function JasperInsightCard({ insight, onRemove }: JasperInsightCardProps) {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissArmed, setDismissArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState(false);

  // Auto-disarm the dismiss confirmation after 5s.
  const armTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (dismissArmed) {
      armTimerRef.current = setTimeout(() => setDismissArmed(false), ARM_TIMEOUT_MS);
    }
    return () => {
      if (armTimerRef.current) {
        clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
    };
  }, [dismissArmed]);

  const fadeAndRemove = () => {
    setFadingOut(true);
    setTimeout(() => onRemove(insight.id), 300);
  };

  const handleRunMission = async () => {
    if (running) {return;}
    setRunning(true);
    setError(null);
    try {
      const res = await authFetch(`/api/jasper/insights/${insight.id}/run-as-mission`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        missionId?: string;
        error?: string;
      };
      if (!res.ok || !data.success || !data.missionId) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      // Drop the card and navigate.
      onRemove(insight.id);
      router.push(`/mission-control?mission=${encodeURIComponent(data.missionId)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start mission';
      setError(msg);
      logger.error('[JasperInsightCard] run-as-mission failed', err instanceof Error ? err : new Error(msg));
      setRunning(false);
    }
  };

  const handleDismissClick = () => {
    if (dismissing) {return;}
    if (!dismissArmed) {
      setDismissArmed(true);
      return;
    }
    void confirmDismiss(false);
  };

  const handleSnooze = () => {
    if (snoozing) {return;}
    void confirmDismiss(true);
  };

  const confirmDismiss = async (snooze: boolean) => {
    if (snooze) {
      setSnoozing(true);
    } else {
      setDismissing(true);
    }
    setError(null);
    try {
      const url = snooze
        ? `/api/jasper/insights/${insight.id}/dismiss?snooze=1`
        : `/api/jasper/insights/${insight.id}/dismiss`;
      const res = await authFetch(url, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      fadeAndRemove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update insight';
      setError(msg);
      logger.error('[JasperInsightCard] dismiss failed', err instanceof Error ? err : new Error(msg));
      if (snooze) {setSnoozing(false);}
      else {setDismissing(false); setDismissArmed(false);}
    }
  };

  const toggleExpanded = () => setExpanded((prev) => !prev);
  const onWhyKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  };

  const pill = URGENCY_PILL[insight.urgency];

  return (
    <motion.div
      data-insight-id={insight.id}
      data-urgency={insight.urgency}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: fadingOut ? 0 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
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

      {/* Expandable "Why?" section. */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={onWhyKeyDown}
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
                insight.signalsSeen.map((signal, idx) => (
                  <li key={idx}>{signal}</li>
                ))
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

      {/* Actions row. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => { void handleRunMission(); }}
          disabled={running || dismissing || snoozing}
          className="gap-1.5"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Rocket className="h-3.5 w-3.5" aria-hidden />
          )}
          {running ? 'Starting…' : 'Run this mission'}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { void handleSnooze(); }}
          disabled={running || dismissing || snoozing}
        >
          {snoozing ? 'Snoozing…' : 'Snooze for today'}
        </Button>

        {/* Two-step destructive dismiss: first click arms (5s auto-disarm),
            second click fires. Cancel button disarms manually. */}
        {dismissArmed ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDismissClick}
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
            onClick={handleDismissClick}
            disabled={running || snoozing}
          >
            Dismiss
          </Button>
        )}

        <Caption className="ml-auto" aria-hidden>
          {insight.category}
        </Caption>
      </div>
    </motion.div>
  );
}

export default JasperInsightCard;
