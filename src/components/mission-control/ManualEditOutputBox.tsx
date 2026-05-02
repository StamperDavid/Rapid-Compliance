'use client';

/**
 * ManualEditOutputBox — M6 quick manual edit affordance.
 *
 * Extracted from mission-control/page.tsx (lines 1259-1442) so it can be
 * imported by both Mission Control and the embeddable <InlineReviewCard>.
 *
 * Renders an "Edit output directly" button that expands into a textarea. On
 * save it POSTs to the edit-output endpoint. Sets manuallyEdited=true on the
 * step as an audit trail. Does NOT fire the Prompt Engineer.
 */

import { useCallback, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ManualEditOutputBoxProps {
  missionId: string;
  stepId: string;
  /** Current toolResult string (raw JSON or plain text). */
  currentResult: string;
  /** Whether the step has already been manually edited (shows an audit badge). */
  isManuallyEdited: boolean;
  /** Called after a successful save so the parent can refresh the step. */
  onSaved?: () => void;
}

export function ManualEditOutputBox({
  missionId,
  stepId,
  currentResult,
  isManuallyEdited,
  onSaved,
}: ManualEditOutputBoxProps) {
  const authFetch = useAuthFetch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    setDraft(currentResult);
    setEditing(true);
    setError(null);
  }, [currentResult]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft('');
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (draft.trim().length === 0) {
      setError('Output cannot be empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/orchestrator/missions/${missionId}/steps/${stepId}/edit-output`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newToolResult: draft }),
        },
      );
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setEditing(false);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }, [authFetch, draft, missionId, stepId, onSaved]);

  return (
    <div className="mt-3 border-t border-border-light pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          Manual edit{' '}
          {isManuallyEdited && (
            <span className="text-warning">· edited</span>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleStart}
            className="rounded border border-border-strong bg-card px-2.5 py-1 text-[0.6875rem] font-semibold text-foreground"
          >
            Edit output directly
          </button>
        )}
      </div>

      {editing && (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            rows={10}
            className="w-full resize-y rounded border border-border-strong bg-surface-elevated p-2 font-mono text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error && (
            <div className="mt-1.5 text-[0.6875rem] text-destructive">
              {error}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="rounded bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save edit'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="rounded border border-border-strong bg-transparent px-3.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
            Saving overwrites the agent&apos;s output with your text. The
            agent&apos;s instructions are NOT changed — this is for small
            tweaks. To train the agent on a pattern, use the rate-this-step
            section instead.
          </div>
        </>
      )}
    </div>
  );
}

export default ManualEditOutputBox;
