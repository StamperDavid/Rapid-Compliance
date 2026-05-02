'use client';

/**
 * UpstreamChangedBanner — M5 upstream-changed notification strip.
 *
 * Extracted from mission-control/page.tsx (lines 1172-1257) so it can be
 * imported by both Mission Control and the embeddable <InlineReviewCard>.
 *
 * Shows a warning band when an earlier step was rerun and this step's output
 * may now be stale. The operator can dismiss by clicking "Still good", which
 * fires the clear-upstream-flag API and hides the banner optimistically.
 */

import { useCallback, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface UpstreamChangedBannerProps {
  missionId: string;
  stepId: string;
  /** Called after the flag is successfully cleared so the parent can re-fetch. */
  onCleared?: () => void;
}

export function UpstreamChangedBanner({ missionId, stepId, onCleared }: UpstreamChangedBannerProps) {
  const authFetch = useAuthFetch();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleStillGood = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(
        `/api/orchestrator/missions/${missionId}/steps/${stepId}/clear-upstream-flag`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      );
      if (res.ok) {
        setDismissed(true);
        onCleared?.();
      }
    } finally {
      setBusy(false);
    }
  }, [authFetch, missionId, stepId, onCleared]);

  if (dismissed) { return null; }

  return (
    <div className="mb-3 rounded-lg border border-warning bg-warning/10 px-4 py-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-warning">
        Upstream changed — re-review?
      </div>
      <div className="mb-2 text-xs leading-relaxed text-foreground">
        An earlier step was rerun. This step&apos;s output may be stale. Decide:
        keep this output as-is, or rerun this step with the updated upstream.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleStillGood()}
          disabled={busy}
          className="rounded border border-border-strong bg-card px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Working...' : 'Still good — keep this output'}
        </button>
      </div>
      <div className="mt-1.5 text-[0.6875rem] text-muted-foreground">
        To rerun this step instead, use the rerun button below.
      </div>
    </div>
  );
}

export default UpstreamChangedBanner;
