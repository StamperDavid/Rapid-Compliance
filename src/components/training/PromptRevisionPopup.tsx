'use client';

/**
 * PromptRevisionPopup
 *
 * A modal that shows a before/after diff of a proposed agent prompt revision.
 * Used across Mission Control, Campaign Review, and Training Center.
 *
 * Features:
 * - Side-by-side diff panels (red = current, green = proposed)
 * - Optional clarifying question from the Prompt Engineer
 * - Approve / Reject / Edit Manually actions
 * - Manual edit mode replaces the right panel with an editable textarea
 * - Escape key closes the modal
 * - Body scroll is locked while open
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PromptRevisionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (fullRevisedPrompt: string, changeDescription: string) => void;
  onReject: () => void;
  agentType: string;
  beforeSection: string;
  afterSection: string;
  clarifyingQuestion?: string;
  changeDescription: string;
  fullRevisedPrompt: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedAfterSection, setEditedAfterSection] = useState(afterSection);

  // Reset editing state and synced text whenever the afterSection prop changes.
  useEffect(() => {
    setEditedAfterSection(afterSection);
    setIsEditing(false);
  }, [afterSection]);

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

  // Early exit — render nothing when closed.
  if (!isOpen) {
    return null;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEnterEditMode() {
    setIsEditing(true);
  }

  function handleSaveEdit() {
    // Replace the beforeSection with the manually edited text inside the full prompt.
    // If beforeSection appears verbatim, do a single replacement; otherwise fall back
    // to swapping afterSection with the edited text inside fullRevisedPrompt.
    let newFullRevisedPrompt: string;

    if (fullRevisedPrompt.includes(afterSection)) {
      newFullRevisedPrompt = fullRevisedPrompt.replace(afterSection, editedAfterSection);
    } else if (fullRevisedPrompt.includes(beforeSection)) {
      newFullRevisedPrompt = fullRevisedPrompt.replace(beforeSection, editedAfterSection);
    } else {
      // Cannot locate a unique substitution point — append edited section as override note.
      newFullRevisedPrompt = `${fullRevisedPrompt}\n\n[Manual edit override]\n${editedAfterSection}`;
    }

    onApprove(newFullRevisedPrompt, changeDescription);
  }

  function handleApprove() {
    onApprove(fullRevisedPrompt, changeDescription);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Prompt Revision — ${agentType}`}
    >
      {/* Modal content — stop click propagation so overlay click doesn't fire from inside */}
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Prompt Revision&nbsp;&mdash;&nbsp;
            <span className="text-indigo-600 dark:text-indigo-400">{agentType}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Diff Panels ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Left — Current */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">
                Current
              </p>
              <pre className="font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[50vh] p-4 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-gray-800 dark:text-gray-200">
                {beforeSection}
              </pre>
            </div>

            {/* Right — Proposed (or editable textarea in edit mode) */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-2">
                {isEditing ? 'Edit Manually' : 'Proposed'}
              </p>
              {isEditing ? (
                <textarea
                  value={editedAfterSection}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setEditedAfterSection(e.target.value)
                  }
                  className="font-mono text-sm w-full p-4 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  style={{ minHeight: '200px', maxHeight: '50vh' }}
                  aria-label="Edit the proposed section"
                />
              ) : (
                <pre className="font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[50vh] p-4 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-200">
                  {afterSection}
                </pre>
              )}
            </div>
          </div>

          {/* ── Clarifying Question ───────────────────────────────────── */}
          {clarifyingQuestion && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                Clarifying Question
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{clarifyingQuestion}</p>
            </div>
          )}

          {/* ── Change Description ────────────────────────────────────── */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-800 dark:text-gray-200">Summary:&nbsp;</span>
            {changeDescription}
          </p>
        </div>

        {/* ── Action Bar ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {/* Reject */}
          <button
            type="button"
            onClick={onReject}
            disabled={isApplying}
            className="px-4 py-2 rounded-md font-medium text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
          >
            Reject
          </button>

          {/* Edit Manually / Save Edit */}
          {isEditing ? (
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isApplying}
              className="px-4 py-2 rounded-md font-medium text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
            >
              Save Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnterEditMode}
              disabled={isApplying}
              className="px-4 py-2 rounded-md font-medium text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
            >
              Edit Manually
            </button>
          )}

          {/* Approve */}
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApplying || isEditing}
            className="px-4 py-2 rounded-md font-medium text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isApplying && <Loader2 className="w-4 h-4 animate-spin" />}
            {isApplying ? 'Applying...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
