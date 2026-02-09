'use client';

import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { focusManagement } from '@/lib/accessibility/aria-utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) { return; }

    previousFocusRef.current = document.activeElement as HTMLElement;
    const el = contentRef.current;
    if (!el) { return; }

    requestAnimationFrame(() => {
      const firstFocusable = focusManagement.getFirstFocusable(el);
      if (firstFocusable) { firstFocusable.focus(); }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      focusManagement.trapFocus(el, e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      focusManagement.returnFocus(previousFocusRef.current);
    };
  }, [open, onClose]);

  const handleConfirm = () => {
    void onConfirm();
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
            className="bg-surface-paper border border-border-light rounded-2xl w-full max-w-md shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                {variant === 'destructive' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
                    <AlertTriangle className="w-5 h-5 text-error" />
                  </div>
                )}
                <div>
                  <h3 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-light">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light rounded-xl transition-all disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${
                  variant === 'destructive'
                    ? 'bg-error hover:bg-error-light text-white'
                    : 'bg-primary hover:bg-primary-light text-white'
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
