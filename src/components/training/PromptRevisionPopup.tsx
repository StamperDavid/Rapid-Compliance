'use client';

/**
 * PromptRevisionPopup
 *
 * Modal that lets an operator review a prompt revision proposal from the
 * Prompt Engineer and make one of three choices:
 *
 *   1. Keep current       — no Golden Master change (honors standing rule
 *                           "no grades = no GM changes")
 *   2. Agent's suggestion — accept the Prompt Engineer's proposed rewrite
 *   3. My rewrite         — write your own replacement text in a textarea
 *
 * Each choice is a radio button at the top of its own box. The box with the
 * active radio gets a visible primary-ring outline so the operator can see
 * what they're submitting. Bottom action bar has a single Submit button —
 * the radio decides what Submit does.
 *
 * Used by:
 *   - src/app/(dashboard)/mission-control/_components/MissionGradeCard.tsx
 *     (existing consumer — grades Jasper / orchestrator GM)
 *   - Step-level grading via StepGradeWidget (Phase M2 — not yet wired)
 *
 * Props interface is BACKWARD-COMPATIBLE with the old 2-panel version —
 * MissionGradeCard does not need any changes to pick up this rewrite. The
 * onApprove callback gains an OPTIONAL third parameter `source` that tells
 * the caller whether the agent's suggestion or the user's rewrite was
 * chosen; callers that don't care about the distinction can ignore it.
 *
 * Replaces the old 2-panel diff popup with "Edit Manually" toggle button.
 * See git history for the old shape if rollback is ever needed.
 *
 * Rewritten April 15, 2026 as part of the Mission Control rebuild (Phase M1).
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// TYPES
// ============================================================================

type RevisionChoice = 'keep' | 'agent' | 'user';

export interface PromptRevisionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the operator submits the "Agent's suggestion" or "My rewrite"
   * radio. Extra params are optional — existing callers that only care about
   * (fullRevisedPrompt, changeDescription) can ignore them.
   *
   * - `source` tells the caller which radio was selected ('agent' or 'user')
   * - `newProposedText` is the resolved section-level text that will become
   *   the new Golden Master section. When source='agent' it equals the
   *   original afterSection; when source='user' it equals the operator's
   *   rewrite. Callers that need to POST to /api/training/grade-specialist/
   *   [id]/approve can use this directly as approvedEdit.proposedText
   *   without having to parse it back out of fullRevisedPrompt.
   */
  onApprove: (
    fullRevisedPrompt: string,
    changeDescription: string,
    source?: 'agent' | 'user',
    newProposedText?: string,
  ) => void;
  /**
   * Called when the operator submits the "Keep current" radio OR closes the
   * popup without selecting anything. Honors the standing rule: no grades =
   * no GM changes. Rejecting a proposed edit is a non-event for the target
   * agent's Golden Master.
   */
  onReject: () => void;
  agentType: string;
  /** The current text of the prompt section the Prompt Engineer targeted. */
  beforeSection: string;
  /** The Prompt Engineer's proposed replacement for that section. */
  afterSection: string;
  /** Optional clarifying question the Prompt Engineer wants the operator to answer. */
  clarifyingQuestion?: string;
  /** Short summary from the Prompt Engineer of WHY this edit addresses the grade. */
  changeDescription: string;
  /**
   * The full agent Golden Master prompt with afterSection already substituted
   * in. If the operator picks "My rewrite", we substitute userRewrite into
   * this full prompt at the afterSection position before calling onApprove.
   */
  fullRevisedPrompt: string;
  /** Shows a spinner on the Submit button while the caller is applying the edit. */
  isApplying?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PromptRevisionPopup({
  isOpen,
  onClose,
  onApprove,
  onReject,
  agentType,
  beforeSection,
  afterSection,
  clarifyingQuestion,
  changeDescription,
  fullRevisedPrompt,
  isApplying = false,
}: PromptRevisionPopupProps) {
  // Default to "agent" on open — the Prompt Engineer's suggestion is the
  // recommended path, and picking it requires zero operator action beyond
  // clicking Submit. Operators who want "Keep current" or "My rewrite" change
  // the radio explicitly.
  const [selected, setSelected] = useState<RevisionChoice>('agent');
  const [userRewrite, setUserRewrite] = useState('');

  // Reset selection and user text whenever a new proposal arrives.
  useEffect(() => {
    setSelected('agent');
    setUserRewrite('');
  }, [afterSection, beforeSection]);

  // Lock body scroll while open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key closes the modal.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  // ── Submit logic ──────────────────────────────────────────────────────────

  const userRewriteTrimmed = userRewrite.trim();
  const userRewriteValid = userRewriteTrimmed.length >= 10;
  const canSubmit = selected === 'keep' || selected === 'agent' || (selected === 'user' && userRewriteValid);

  function handleSubmit() {
    if (selected === 'keep') {
      // Standing rule #2 — no grades = no GM changes. Rejecting proposed edit
      // means zero Firestore writes to the target agent's GM.
      onReject();
      return;
    }

    if (selected === 'agent') {
      // newProposedText = the agent's original suggestion (afterSection).
      onApprove(fullRevisedPrompt, changeDescription, 'agent', afterSection);
      return;
    }

    // selected === 'user' — substitute the operator's text into the full
    // prompt at the same position the agent's suggestion would have gone.
    let newFullRevisedPrompt: string;
    if (fullRevisedPrompt.includes(afterSection)) {
      newFullRevisedPrompt = fullRevisedPrompt.replace(afterSection, userRewriteTrimmed);
    } else if (fullRevisedPrompt.includes(beforeSection)) {
      newFullRevisedPrompt = fullRevisedPrompt.replace(beforeSection, userRewriteTrimmed);
    } else {
      // Neither afterSection nor beforeSection appears verbatim in the full
      // prompt — something upstream is off. Fall back to appending the user's
      // rewrite as an override block so no data is lost. The backend deploy
      // path will reject this if the currentText verbatim check fails, which
      // is the correct loud-failure behavior.
      newFullRevisedPrompt = `${fullRevisedPrompt}\n\n[Manual operator rewrite]\n${userRewriteTrimmed}`;
    }
    onApprove(newFullRevisedPrompt, changeDescription, 'user', userRewriteTrimmed);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function boxClassName(choice: RevisionChoice): string {
    const base = 'flex flex-col rounded-lg border p-3 transition-all';
    const active = selected === choice
      ? 'border-primary ring-2 ring-primary bg-surface-elevated'
      : 'border-border bg-card hover:border-border-strong';
    return `${base} ${active}`;
  }

  function radioId(choice: RevisionChoice): string {
    return `prompt-revision-radio-${choice}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Prompt Revision — ${agentType}`}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-border-strong"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-foreground">
              Prompt Revision &mdash; <span className="text-primary">{agentType}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick one option and click Submit. Close without submitting to leave the Golden Master unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-box picker */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Box 1 — Keep current */}
            <div className={boxClassName('keep')}>
              <label htmlFor={radioId('keep')} className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  id={radioId('keep')}
                  type="radio"
                  name="promptRevisionChoice"
                  value="keep"
                  checked={selected === 'keep'}
                  onChange={() => setSelected('keep')}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-sm font-semibold text-foreground">Keep current</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Nothing changes. {agentType}&apos;s Golden Master stays exactly as it is.
              </p>
              <pre className="flex-1 font-mono text-xs whitespace-pre-wrap overflow-auto min-h-[200px] max-h-[45vh] p-3 rounded bg-surface-elevated border border-border text-foreground">
                {beforeSection}
              </pre>
            </div>

            {/* Box 2 — Agent's suggestion */}
            <div className={boxClassName('agent')}>
              <label htmlFor={radioId('agent')} className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  id={radioId('agent')}
                  type="radio"
                  name="promptRevisionChoice"
                  value="agent"
                  checked={selected === 'agent'}
                  onChange={() => setSelected('agent')}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-sm font-semibold text-foreground">Agent&apos;s suggestion</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Replace the current section with what the Prompt Engineer proposed.
              </p>
              <pre className="flex-1 font-mono text-xs whitespace-pre-wrap overflow-auto min-h-[200px] max-h-[45vh] p-3 rounded bg-surface-elevated border border-border text-foreground">
                {afterSection}
              </pre>
            </div>

            {/* Box 3 — My rewrite */}
            <div className={boxClassName('user')}>
              <label htmlFor={radioId('user')} className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  id={radioId('user')}
                  type="radio"
                  name="promptRevisionChoice"
                  value="user"
                  checked={selected === 'user'}
                  onChange={() => setSelected('user')}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-sm font-semibold text-foreground">My rewrite</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Write your own replacement for the current section. Minimum 10 characters.
              </p>
              <textarea
                value={userRewrite}
                onChange={(e) => {
                  setUserRewrite(e.target.value);
                  if (selected !== 'user') { setSelected('user'); }
                }}
                placeholder="Write your replacement for the highlighted section here..."
                className="flex-1 font-mono text-xs w-full p-3 rounded bg-surface-elevated border border-border text-foreground min-h-[200px] max-h-[45vh] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Write your own replacement"
              />
              {selected === 'user' && !userRewriteValid && (
                <p className="text-xs text-muted-foreground mt-2">
                  {userRewriteTrimmed.length} / 10 characters minimum
                </p>
              )}
            </div>
          </div>

          {/* Clarifying question — shown when the Prompt Engineer asked for more context */}
          {clarifyingQuestion && (
            <div className="rounded-lg border border-border-strong bg-surface-elevated p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-1">
                Clarifying question from the Prompt Engineer
              </p>
              <p className="text-sm text-muted-foreground">{clarifyingQuestion}</p>
            </div>
          )}

          {/* Change description — what the Prompt Engineer says the edit fixes */}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-1">
              What this edit fixes
            </p>
            <p className="text-sm text-muted-foreground">{changeDescription}</p>
          </div>
        </div>

        {/* Action bar — single Submit button. The radio decides what Submit does. */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {selected === 'keep' && 'No change will be saved. Golden Master stays as-is.'}
            {selected === 'agent' && 'The Prompt Engineer\u2019s suggestion will become the new Golden Master version.'}
            {selected === 'user' && 'Your rewrite will become the new Golden Master version.'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isApplying || !canSubmit}>
              {isApplying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isApplying ? 'Applying...' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
