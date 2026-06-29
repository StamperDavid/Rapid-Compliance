'use client';

/**
 * MergeRecordsDialog — pick which of two duplicate CRM records to keep, then merge.
 *
 * The kept record wins on every field; the other record fills any blanks, then is
 * deleted. Posts to /api/crm/duplicates/merge, which re-parents the merged record's
 * child records (deals/quotes/invoices/payments/emails/activities) onto the kept one
 * before deletion. Reusable across entity types; today it's wired on Contacts (the
 * only entity whose backend child re-parenting is implemented).
 */

import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Loader2, AlertTriangle, Check } from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { focusManagement } from '@/lib/accessibility/aria-utils';

export interface MergeRecord {
  id: string;
  label: string;
  sublabel?: string;
}

interface MergeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface MergeRecordsDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: 'lead' | 'contact' | 'company' | 'deal';
  recordA: MergeRecord;
  recordB: MergeRecord;
  /** Called after a successful merge with the backend's summary message. */
  onMerged: (message: string) => void;
}

export function MergeRecordsDialog({
  open,
  onClose,
  entityType,
  recordA,
  recordB,
  onMerged,
}: MergeRecordsDialogProps) {
  const authFetch = useAuthFetch();
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const [keepId, setKeepId] = useState(recordA.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset selection + error each time the dialog opens for a new pair.
  useEffect(() => {
    if (open) {
      setKeepId(recordA.id);
      setError(null);
      setLoading(false);
    }
  }, [open, recordA.id]);

  useEffect(() => {
    if (!open) { return; }
    previousFocusRef.current = document.activeElement as HTMLElement;
    const el = contentRef.current;
    if (!el) { return; }
    requestAnimationFrame(() => {
      const first = focusManagement.getFirstFocusable(el);
      if (first) { first.focus(); }
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      focusManagement.trapFocus(el, e);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      focusManagement.returnFocus(previousFocusRef.current);
    };
  }, [open, onClose]);

  const mergeId = keepId === recordA.id ? recordB.id : recordA.id;

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/crm/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, keepId, mergeId }),
      });
      const data = (await res.json()) as MergeResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not merge the records.');
        return;
      }
      onMerged(data.message ?? 'Records merged.');
      onClose();
    } catch {
      setError('Network error while merging the records.');
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (record: MergeRecord) => {
    const selected = keepId === record.id;
    return (
      <button
        type="button"
        key={record.id}
        onClick={() => setKeepId(record.id)}
        disabled={loading}
        aria-pressed={selected}
        className={`w-full text-left rounded-xl border p-4 transition-all disabled:opacity-50 ${
          selected
            ? 'border-primary bg-surface-elevated'
            : 'border-border-light bg-card hover:border-border-strong'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{record.label}</p>
            {record.sublabel && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{record.sublabel}</p>
            )}
          </div>
          <span
            className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
              selected ? 'bg-primary border-primary' : 'border-border-strong'
            }`}
          >
            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
          </span>
        </div>
        <p className={`mt-2 text-xs font-medium ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
          {selected ? 'Keep this one' : 'Will be merged in & removed'}
        </p>
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-paper border border-border-light rounded-2xl w-full max-w-lg shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-elevated">
                  <GitMerge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 id={titleId} className="text-lg font-semibold text-foreground">
                    Merge duplicate {entityType}s
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick the record to keep. The other one fills any blanks on it and is then
                    deleted. Linked records move to the kept one. This can&apos;t be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {renderCard(recordA)}
                {renderCard(recordB)}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-sm text-error">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-light">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-muted-foreground bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleMerge()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 bg-primary hover:bg-primary-light text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                Merge
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
