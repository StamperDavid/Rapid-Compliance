'use client';

/**
 * SpecialistRecentWork — last N completed outputs from a specialist with
 * inline grading entry points.
 *
 * Self-fetching: hits `/api/agents/specialist/[id]/recent-work?limit=N`
 * (Stream A owns) and renders a list of recent step outputs. Each ungraded
 * item shows a "Grade this" button that deep-links into Mission Control's
 * review page (`/mission-control/review?mission=...&step=...`) where the
 * existing `StepGradeWidget` is already mounted on the step detail panel.
 *
 * TODO (v2 refactor — explicitly out of scope per Phase 2 Stream B spec):
 *   Lift `StepGradeWidget` out of `mission-control/_components/` so we can
 *   import it here and pop it inline as a modal. Currently `_components/` is
 *   a Next.js route-private convention — importing from a sibling route's
 *   private folder works at the TS level but violates the boundary, so we
 *   route the operator to the existing review surface instead.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';

// ============================================================================
// TYPES
// ============================================================================

type GradeKind = 'reject' | 'request_revision' | 'approve_with_notes';

interface RecentWorkItem {
  missionId: string;
  stepId: string;
  stepName: string;
  completedAt: string;
  outputExcerpt: string;
  platform: string | null;
  grade: {
    grade: GradeKind;
    explanation: string;
    submittedAt: string;
  } | null;
}

interface RecentWorkResponse {
  success: boolean;
  recentWork?: RecentWorkItem[];
  error?: string;
}

export interface SpecialistRecentWorkProps {
  specialistId: string;
  limit?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) { return 'recently'; }

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) { return 'just now'; }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) { return `${minutes}m ago`; }

  const hours = Math.round(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }

  const days = Math.round(hours / 24);
  if (days < 30) { return `${days}d ago`; }

  const months = Math.round(days / 30);
  if (months < 12) { return `${months}mo ago`; }

  const years = Math.round(months / 12);
  return `${years}y ago`;
}

function gradePillClasses(grade: GradeKind): { className: string; label: string } {
  switch (grade) {
    case 'approve_with_notes':
      return {
        className: 'bg-success/10 text-success border border-success/30',
        label: 'Approved',
      };
    case 'request_revision':
      return {
        className: 'bg-warning/10 text-warning border border-warning/30',
        label: 'Revision requested',
      };
    case 'reject':
      return {
        className: 'bg-destructive/10 text-destructive border border-destructive/30',
        label: 'Rejected',
      };
  }
}

const DEFAULT_LIMIT = 10;

// ============================================================================
// COMPONENT
// ============================================================================

export default function SpecialistRecentWork({
  specialistId,
  limit = DEFAULT_LIMIT,
}: SpecialistRecentWorkProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RecentWorkItem[]>([]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/agents/specialist/${encodeURIComponent(specialistId)}/recent-work?limit=${limit}`;
      const res = await authFetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as RecentWorkResponse;
      if (!body.success) {
        throw new Error(body.error ?? 'Failed to load recent work');
      }
      setItems(body.recentWork ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, specialistId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGrade = useCallback(
    (missionId: string, stepId: string): void => {
      router.push(
        `/mission-control/review?mission=${encodeURIComponent(missionId)}&step=${encodeURIComponent(stepId)}`,
      );
    },
    [router],
  );

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-border-light">
        <CardHeader>
          <CardTitle>Recently</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border-light p-3">
              <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // ─── ERROR ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="border-border-light">
        <CardHeader>
          <CardTitle>Recently</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load recent work — {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── EMPTY ─────────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <Card className="border-border-light">
        <CardHeader>
          <CardTitle>Recently</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No completed work yet for this specialist.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── LOADED ────────────────────────────────────────────────────────────────
  return (
    <Card className="border-border-light">
      <CardHeader>
        <CardTitle>Recently</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => {
            const pill = item.grade ? gradePillClasses(item.grade.grade) : null;
            return (
              <li
                key={`${item.missionId}-${item.stepId}`}
                className="rounded-md border border-border-light bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.stepName}
                    </p>
                    <Caption>{formatRelativeTime(item.completedAt)}</Caption>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.platform && (
                      <span className="inline-flex items-center rounded-full border border-border-light bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {item.platform}
                      </span>
                    )}
                    {pill && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.className}`}
                      >
                        {pill.label}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.outputExcerpt}
                </p>

                {!item.grade && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGrade(item.missionId, item.stepId)}
                    >
                      Grade this
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
