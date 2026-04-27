'use client';

/**
 * SpecialistIdentityCard — renders the AI specialist's identity for a
 * per-platform Social Hub dashboard.
 *
 * Self-fetching: hits `/api/agents/specialist/[id]` (Stream A owns) and
 * renders four sections:
 *   1. Header — name + platform-color accent dot
 *   2. Identity strip — reportsTo, model, GM version
 *   3. "Right now" — currently-working list (clickable → Mission Control)
 *   4. "Last graded" — most recent grade pill + relative time
 *   5. Footer — "Talk to Jasper about this specialist" CTA
 *
 * Loading, error, and empty-GM states are all handled inline.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
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
type WorkStatus = 'IN_PROGRESS' | 'AWAITING_APPROVAL';

interface SpecialistDetail {
  id: string;
  name: string;
  role: 'specialist';
  reportsTo: string;
  capabilities: string[];
  activeGM: {
    version: number;
    industryKey: string;
    docId: string;
    deployedAt: string;
    model: string;
  } | null;
  lastGrade: {
    grade: GradeKind;
    explanation: string;
    submittedAt: string;
    submittedBy: string;
  } | null;
  currentlyWorking: Array<{
    missionId: string;
    missionTitle: string;
    stepName: string;
    status: WorkStatus;
    startedAt: string;
  }>;
}

interface SpecialistResponse {
  success: boolean;
  specialist?: SpecialistDetail;
  error?: string;
}

export interface SpecialistIdentityCardProps {
  specialistId: string;
  platform: SocialPlatform;
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
  if (minutes < 60) { return `${minutes} minute${minutes === 1 ? '' : 's'} ago`; }

  const hours = Math.round(minutes / 60);
  if (hours < 24) { return `${hours} hour${hours === 1 ? '' : 's'} ago`; }

  const days = Math.round(hours / 24);
  if (days < 30) { return `${days} day${days === 1 ? '' : 's'} ago`; }

  const months = Math.round(days / 30);
  if (months < 12) { return `${months} month${months === 1 ? '' : 's'} ago`; }

  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function gradePillClasses(grade: GradeKind): { className: string; label: string } {
  switch (grade) {
    case 'approve_with_notes':
      return {
        className: 'bg-success/10 text-success border border-success/30',
        label: 'Approved with notes',
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

function workStatusLabel(status: WorkStatus): string {
  return status === 'IN_PROGRESS' ? 'In progress' : 'Awaiting your approval';
}

function workStatusPillClasses(status: WorkStatus): string {
  return status === 'IN_PROGRESS'
    ? 'bg-primary/10 text-primary border border-primary/30'
    : 'bg-warning/10 text-warning border border-warning/30';
}

function truncate(str: string, max: number): string {
  if (!str) { return ''; }
  return str.length <= max ? str : `${str.slice(0, max - 1).trimEnd()}…`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SpecialistIdentityCard({
  specialistId,
  platform,
}: SpecialistIdentityCardProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const meta = PLATFORM_META[platform];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialist, setSpecialist] = useState<SpecialistDetail | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/agents/specialist/${encodeURIComponent(specialistId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as SpecialistResponse;
      if (!body.success || !body.specialist) {
        throw new Error(body.error ?? 'Specialist not found');
      }
      setSpecialist(body.specialist);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSpecialist(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch, specialistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTalkToJasper = useCallback((): void => {
    if (!specialist) { return; }
    const prefill = `Tell me about my ${specialist.name}`;
    router.push(`/dashboard?prefill=${encodeURIComponent(prefill)}`);
  }, [router, specialist]);

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-border-light">
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  // ─── ERROR ─────────────────────────────────────────────────────────────────
  if (error || !specialist) {
    return (
      <Card className="border-border-light">
        <CardHeader>
          <CardTitle>Couldn&apos;t load specialist info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {error ?? 'Unknown error fetching specialist.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── LOADED ────────────────────────────────────────────────────────────────
  const lastGradePill = specialist.lastGrade ? gradePillClasses(specialist.lastGrade.grade) : null;

  return (
    <Card className="border-border-light">
      <CardHeader>
        <div className="flex items-center gap-2">
          {/* Platform-color accent dot — dynamic color, documented exception. */}
          <span
            aria-hidden
            style={{ backgroundColor: meta.color }}
            className="inline-block h-2.5 w-2.5 rounded-full"
          />
          <CardTitle>{specialist.name}</CardTitle>
        </div>

        {/* Identity strip */}
        <p className="text-xs text-muted-foreground mt-1">
          Reports to: {specialist.reportsTo}
          {specialist.activeGM && (
            <>
              <span className="mx-1.5">,</span>
              Model: {specialist.activeGM.model}
              <span className="mx-1.5">,</span>
              GM version: v{specialist.activeGM.version}
            </>
          )}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Empty-GM notice */}
        {!specialist.activeGM && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
            <p className="text-xs text-warning">
              No Golden Master seeded for this specialist yet — operating on defaults.
            </p>
          </div>
        )}

        {/* Right now — only when there's active work */}
        {specialist.currentlyWorking.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Right now
            </h5>
            <ul className="space-y-1.5">
              {specialist.currentlyWorking.map((item) => (
                <li key={`${item.missionId}-${item.stepName}`}>
                  <button
                    type="button"
                    onClick={() => {
                      // Mission Control's actual deep-link param is `mission`;
                      // we send `missionId` too so the spec-named param works
                      // if Stream A adds an alias.
                      const id = encodeURIComponent(item.missionId);
                      router.push(`/mission-control?mission=${id}&missionId=${id}`);
                    }}
                    className="w-full text-left flex items-center justify-between gap-2 rounded-md border border-border-light bg-card px-3 py-2 hover:bg-surface-elevated transition-colors"
                  >
                    <span className="text-sm text-foreground truncate">
                      {item.stepName}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${workStatusPillClasses(item.status)}`}
                    >
                      {workStatusLabel(item.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last graded — only when there's a grade */}
        {specialist.lastGrade && lastGradePill && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Last graded
            </h5>
            <div className="rounded-md border border-border-light bg-card px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${lastGradePill.className}`}
                >
                  {lastGradePill.label}
                </span>
                <Caption>{formatRelativeTime(specialist.lastGrade.submittedAt)}</Caption>
              </div>
              <p className="text-xs text-muted-foreground">
                {truncate(specialist.lastGrade.explanation, 160)}
              </p>
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={handleTalkToJasper}>
            Talk to Jasper about this specialist
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
