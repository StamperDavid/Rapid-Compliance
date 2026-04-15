'use client';

/**
 * SpecialistVersionHistory — minimal rollback UI for M2d.
 *
 * Inline panel that shows all Golden Master versions of a specialist and
 * lets the operator roll back to any past version with a single confirmation.
 *
 * Mounted from Mission Control's step detail panel as a small expander: the
 * operator clicks a specialist name/badge on a graded step, this panel opens,
 * fetches the version list, and offers one-click rollback per past version.
 *
 * Per Q1/A decision: single confirmation dialog, no required reason text.
 * The reason field on the rollback endpoint is optional — we don't prompt
 * for it in M2d to keep the friction low. Add it later if needed.
 *
 * Usage:
 *   <SpecialistVersionHistory
 *     specialistId="COPYWRITER"
 *     industryKey="saas_sales_ops"  // optional, defaults to saas_sales_ops
 *     onClose={() => setShowHistory(false)}
 *   />
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';

// ============================================================================
// TYPES
// ============================================================================

interface VersionListItem {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  notes?: string;
  previousVersion?: number;
  deployedAt?: string;
  systemPromptLength: number;
}

interface VersionListResponse {
  success: boolean;
  activeVersion: number | null;
  versions: VersionListItem[];
  count: number;
  error?: string;
}

interface RollbackResponse {
  success: boolean;
  specialistId?: string;
  industryKey?: string;
  rolledBackToVersion?: number;
  error?: string;
}

interface Props {
  specialistId: string;
  industryKey?: string;
  onClose: () => void;
}

const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

// ============================================================================
// COMPONENT
// ============================================================================

export default function SpecialistVersionHistory({
  specialistId,
  industryKey = DEFAULT_INDUSTRY_KEY,
  onClose,
}: Props) {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [rollingBackTo, setRollingBackTo] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<number | null>(null);

  // Load versions on mount
  const loadVersions = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/training/grade-specialist/${specialistId}/versions?industryKey=${encodeURIComponent(industryKey)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as VersionListResponse;
      setVersions(body.versions);
      setActiveVersion(body.activeVersion);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load version history: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [authFetch, specialistId, industryKey, toast]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  // Rollback
  const handleRollback = useCallback(async (targetVersion: number): Promise<void> => {
    setRollingBackTo(targetVersion);
    setPendingConfirm(null);
    try {
      const res = await authFetch(
        `/api/training/grade-specialist/${specialistId}/rollback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industryKey, targetVersion }),
        },
      );
      const body = (await res.json()) as RollbackResponse;
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Rolled back ${specialistId} to v${targetVersion}. Next call will use the rolled-back prompt.`);
      await loadVersions();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Rollback failed: ${msg}`);
    } finally {
      setRollingBackTo(null);
    }
  }, [authFetch, specialistId, industryKey, toast, loadVersions]);

  return (
    <div className="mt-3 rounded-lg border border-border-strong bg-surface-elevated p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{specialistId} — version history</p>
          <Caption>{industryKey}</Caption>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      {loading && <Caption>Loading versions…</Caption>}

      {!loading && versions.length === 0 && (
        <Caption>No versions found. This specialist may not have a seeded Golden Master yet.</Caption>
      )}

      {!loading && versions.length > 0 && (
        <ul className="space-y-2">
          {versions.map((v) => {
            const isActive = v.isActive || v.version === activeVersion;
            const confirmingThis = pendingConfirm === v.version;
            const rollingThis = rollingBackTo === v.version;

            return (
              <li
                key={v.id}
                className={`rounded-md border p-2 ${isActive ? 'border-primary bg-card' : 'border-border bg-card'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">v{v.version}</span>
                      {isActive && (
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">active</span>
                      )}
                      <Caption>{new Date(v.createdAt).toLocaleString()}</Caption>
                    </div>
                    <Caption>
                      {v.createdBy} — {v.systemPromptLength} chars
                      {v.previousVersion !== undefined && v.previousVersion > 0
                        ? ` (from v${v.previousVersion})`
                        : ''}
                    </Caption>
                    {v.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.notes}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {!isActive && !confirmingThis && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rollingBackTo !== null}
                        onClick={() => { setPendingConfirm(v.version); }}
                      >
                        Roll back
                      </Button>
                    )}
                    {!isActive && confirmingThis && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={rollingThis}
                          onClick={() => { void handleRollback(v.version); }}
                        >
                          {rollingThis ? 'Rolling back…' : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rollingThis}
                          onClick={() => { setPendingConfirm(null); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Caption>
        Rolling back deactivates the current active version and activates the one you pick. The next specialist call uses the rolled-back prompt.
      </Caption>
    </div>
  );
}
